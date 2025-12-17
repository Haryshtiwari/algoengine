/**
 * Position Manager
 * CRUD operations for positions table
 */

const db = require('../config/db');
const logger = require('../config/logger');

/**
 * Get current open position for user-strategy-symbol
 */
async function getCurrentPosition(userId, strategyId, canonicalSymbol) {
  const [position] = await db.query(
    `SELECT * FROM positions 
     WHERE userId = ? AND strategyId = ? AND canonicalSymbol = ? AND status = 'OPEN'
     LIMIT 1`,
    [userId, strategyId, canonicalSymbol]
  );

  return position || null;
}

/**
 * Create new position
 */
async function createPosition(data) {
  const {
    userId,
    strategyId,
    segment,
    canonicalSymbol,
    brokerSymbol,
    side,
    qty,
    entryOrderId,
    entryPrice,
    subscription,
  } = data;

  // Calculate SL/TP prices if enabled
  let slPrice = null;
  let tpPrice = null;

  if (subscription.slEnabled && subscription.slValue) {
    slPrice = calculateSLTP(
      entryPrice, 
      side, 
      subscription.slType, 
      subscription.slValue, 
      'SL'
    );
  }

  if (subscription.tpEnabled && subscription.tpValue) {
    tpPrice = calculateSLTP(
      entryPrice, 
      side, 
      subscription.tpType, 
      subscription.tpValue, 
      'TP'
    );
  }

  const result = await db.query(
    `INSERT INTO positions 
      (userId, strategyId, segment, canonicalSymbol, brokerSymbol, side, qty,
       entryOrderId, entryPrice, slPrice, tpPrice, status, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', NOW())`,
    [
      userId,
      strategyId,
      segment,
      canonicalSymbol,
      brokerSymbol || canonicalSymbol,
      side,
      qty,
      entryOrderId,
      entryPrice,
      slPrice,
      tpPrice,
    ]
  );

  logger.info('✅ Position created', { 
    positionId: result.insertId, 
    userId, 
    side, 
    qty,
    slPrice,
    tpPrice,
  });

  return result.insertId;
}

/**
 * Close position
 */
async function closePosition(positionId, exitData) {
  const { exitOrderId, exitPrice, exitReason } = exitData;

  // Fetch position to calculate PnL
  const [position] = await db.query(
    'SELECT * FROM positions WHERE id = ?',
    [positionId]
  );

  if (!position) {
    throw new Error(`Position ${positionId} not found`);
  }

  // Calculate PnL
  const pnl = calculatePnL(
    position.side,
    position.qty,
    position.entryPrice,
    exitPrice
  );

  const pnlPercentage = ((pnl / (position.entryPrice * position.qty)) * 100).toFixed(2);

  await db.query(
    `UPDATE positions 
     SET exitOrderId = ?, exitPrice = ?, exitAt = NOW(), exitReason = ?,
         pnl = ?, pnlPercentage = ?, status = 'CLOSED', updatedAt = NOW()
     WHERE id = ?`,
    [exitOrderId, exitPrice, exitReason, pnl, pnlPercentage, positionId]
  );

  logger.info('✅ Position closed', { 
    positionId, 
    exitReason, 
    pnl, 
    pnlPercentage: `${pnlPercentage}%` 
  });
}

/**
 * Get all open positions with SL/TP enabled
 */
async function getOpenSLTPPositions() {
  return await db.query(
    `SELECT p.*, ss.exitMode
     FROM positions p
     JOIN StrategySubscriptions ss ON p.userId = ss.userId AND p.strategyId = ss.strategyId
     WHERE p.status = 'OPEN' 
       AND ss.exitMode = 'SLTP'
       AND (p.slPrice IS NOT NULL OR p.tpPrice IS NOT NULL)`
  );
}

/**
 * Calculate SL/TP price
 */
function calculateSLTP(entryPrice, side, type, value, mode) {
  let price;

  if (type === 'POINTS') {
    if (mode === 'SL') {
      price = side === 'LONG' ? entryPrice - value : entryPrice + value;
    } else {
      price = side === 'LONG' ? entryPrice + value : entryPrice - value;
    }
  } else if (type === 'PERCENT') {
    const factor = value / 100;
    if (mode === 'SL') {
      price = side === 'LONG' ? entryPrice * (1 - factor) : entryPrice * (1 + factor);
    } else {
      price = side === 'LONG' ? entryPrice * (1 + factor) : entryPrice * (1 - factor);
    }
  }

  return parseFloat(price.toFixed(8));
}

/**
 * Calculate PnL
 */
function calculatePnL(side, qty, entryPrice, exitPrice) {
  if (side === 'LONG') {
    return (exitPrice - entryPrice) * qty;
  } else {
    return (entryPrice - exitPrice) * qty;
  }
}

module.exports = {
  getCurrentPosition,
  createPosition,
  closePosition,
  getOpenSLTPPositions,
};
