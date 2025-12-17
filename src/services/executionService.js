/**
 * Execution Service
 * Core engine: state reconciliation + per-user execution
 */

const { Mutex } = require('async-mutex');
const db = require('../config/db');
const logger = require('../config/logger');
const positionManager = require('./positionManager');
const brokerFactory = require('../brokers/brokerFactory');

// Per (userId, strategyId) mutex to prevent race conditions
const executionLocks = new Map();

function getLock(userId, strategyId) {
  const key = `${userId}_${strategyId}`;
  if (!executionLocks.has(key)) {
    executionLocks.set(key, new Mutex());
  }
  return executionLocks.get(key);
}

/**
 * Execute signal for all strategy subscribers
 */
async function executeForSignal(signalLog) {
  const { id: signalLogId, strategyId, signal, canonicalSymbol, segment } = signalLog;

  logger.info('🔄 Executing signal for subscribers', { signalLogId, strategyId, signal });

  // Fetch all active subscribers for this strategy
  const subscribers = await db.query(
    `SELECT 
      ss.id AS subscriptionId,
      ss.userId,
      ss.strategyId,
      ss.qty,
      ss.lots,
      ss.isActive,
      ss.slEnabled,
      ss.slType,
      ss.slValue,
      ss.tpEnabled,
      ss.tpType,
      ss.tpValue,
      ss.exitMode,
      u.id AS userId,
      u.name AS userName,
      ak.id AS apiKeyId,
      ak.broker,
      ak.segment AS brokerSegment,
      ak.apiKey,
      ak.apiSecret,
      ak.passphrase
     FROM StrategySubscriptions ss
     JOIN users u ON ss.userId = u.id
     LEFT JOIN apikeys ak ON ak.userId = u.id AND ak.segment = ? AND ak.status = 'Active'
     WHERE ss.strategyId = ? AND ss.isActive = 1
     ORDER BY ss.userId`,
    [segment, strategyId]
  );

  if (subscribers.length === 0) {
    logger.info('ℹ️  No active subscribers found', { strategyId });
    return;
  }

  logger.info(`👥 Found ${subscribers.length} subscriber(s)`);

  // Execute for each user (with concurrency control)
  const maxConcurrent = parseInt(process.env.MAX_CONCURRENT_EXECUTIONS) || 10;
  const chunks = chunkArray(subscribers, maxConcurrent);

  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(sub => executeForUser(signalLog, sub))
    );
  }

  logger.info('✅ Signal execution completed for all subscribers', { signalLogId });
}

/**
 * Execute signal for a single user (with lock)
 */
async function executeForUser(signalLog, subscription) {
  const { userId, strategyId } = subscription;
  const lock = getLock(userId, strategyId);

  const release = await lock.acquire();
  
  try {
    await _executeForUserInternal(signalLog, subscription);
  } catch (error) {
    logger.error('❌ User execution failed', { 
      userId, 
      strategyId, 
      error: error.message 
    });
  } finally {
    release();
  }
}

/**
 * Internal execution logic (state reconciliation)
 */
async function _executeForUserInternal(signalLog, subscription) {
  const { 
    userId, 
    strategyId, 
    qty, 
    lots,
    broker,
    apiKeyId,
    apiKey,
    apiSecret,
    slEnabled,
    tpEnabled,
    slType,
    slValue,
    tpType,
    tpValue,
    exitMode,
  } = subscription;

  const { id: signalLogId, signal, canonicalSymbol, segment } = signalLog;

  logger.info('⚙️  Processing user', { userId, strategyId, signal });

  // Map signal to target side
  const targetSide = signalToSide(signal);

  // Get current position
  const currentPosition = await positionManager.getCurrentPosition(
    userId, 
    strategyId, 
    canonicalSymbol
  );

  const currentSide = currentPosition ? currentPosition.side : 'FLAT';

  logger.debug('State', { userId, currentSide, targetSide });

  // Log execution decision
  let decision, reason;

  // STATE RECONCILIATION LOGIC
  if (targetSide === 'FLAT') {
    // Signal = 0 → Force exit everyone
    if (currentSide === 'FLAT') {
      decision = 'SKIP';
      reason = 'NO_POSITION';
    } else {
      decision = 'EXIT';
      reason = 'FORCE_EXIT_SIGNAL_0';
      await exitPosition(currentPosition, subscription, 'SIGNAL_0');
    }

  } else if (targetSide === currentSide) {
    // Already aligned
    decision = 'SKIP';
    reason = 'ALREADY_IN_TARGET_SIDE';

  } else if (currentSide === 'FLAT') {
    // Fresh entry
    decision = 'ENTER';
    reason = 'NEW_ENTRY';
    await enterPosition(targetSide, subscription, signalLog);

  } else {
    // Reversal: current != target and both are LONG/SHORT
    decision = 'REVERSE';
    reason = 'SIGNAL_REVERSAL';
    await reversePosition(currentPosition, targetSide, subscription, signalLog);
  }

  // Log execution
  await db.query(
    `INSERT INTO execution_logs 
      (signalLogId, userId, strategyId, decision, reason, currentSide, targetSide, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
    [signalLogId, userId, strategyId, decision, reason, currentSide, targetSide]
  );

  logger.info(`✔ User processed: ${decision}`, { userId, reason });
}

/**
 * Enter new position
 */
async function enterPosition(side, subscription, signalLog) {
  const { userId, strategyId, qty, lots, broker, apiKey, apiSecret } = subscription;
  const { canonicalSymbol, segment } = signalLog;

  const finalQty = qty || lots || 1; // Use qty if set, fallback to lots

  logger.info('📈 Entering position', { userId, side, qty: finalQty });

  // Get broker adapter
  const brokerAdapter = brokerFactory.getAdapter(broker, { apiKey, apiSecret });

  // Place entry order
  const order = await brokerAdapter.placeOrder({
    side: side === 'LONG' ? 'BUY' : 'SELL',
    symbol: canonicalSymbol,
    qty: finalQty,
    orderType: 'MARKET',
  });

  // Create position record
  await positionManager.createPosition({
    userId,
    strategyId,
    segment,
    canonicalSymbol,
    side,
    qty: finalQty,
    entryOrderId: order.orderId,
    entryPrice: order.fillPrice,
    subscription,
  });

  logger.info('✅ Position entered', { userId, side, orderId: order.orderId });
}

/**
 * Exit existing position
 */
async function exitPosition(position, subscription, exitReason) {
  const { userId, side, qty, canonicalSymbol } = position;
  const { broker, apiKey, apiSecret } = subscription;

  logger.info('📉 Exiting position', { userId, side, qty, exitReason });

  const brokerAdapter = brokerFactory.getAdapter(broker, { apiKey, apiSecret });

  // Place exit order (opposite side)
  const order = await brokerAdapter.placeOrder({
    side: side === 'LONG' ? 'SELL' : 'BUY',
    symbol: canonicalSymbol,
    qty,
    orderType: 'MARKET',
  });

  // Close position record
  await positionManager.closePosition(position.id, {
    exitOrderId: order.orderId,
    exitPrice: order.fillPrice,
    exitReason,
  });

  logger.info('✅ Position exited', { userId, orderId: order.orderId });
}

/**
 * Reverse position (close + open opposite)
 */
async function reversePosition(currentPosition, newSide, subscription, signalLog) {
  logger.info('🔄 Reversing position', { 
    userId: currentPosition.userId, 
    from: currentPosition.side, 
    to: newSide 
  });

  // Step 1: Close current
  await exitPosition(currentPosition, subscription, 'REVERSAL');

  // Step 2: Open new
  await enterPosition(newSide, subscription, signalLog);

  logger.info('✅ Position reversed');
}

/**
 * Map signal integer to side enum
 */
function signalToSide(signal) {
  if (signal === 1) return 'LONG';
  if (signal === -1) return 'SHORT';
  if (signal === 0) return 'FLAT';
  throw new Error(`Invalid signal: ${signal}`);
}

/**
 * Split array into chunks
 */
function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

module.exports = {
  executeForSignal,
};
