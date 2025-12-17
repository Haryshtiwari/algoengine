/**
 * SL/TP Monitor Service
 * Background worker that monitors open positions with SL/TP
 */

const cron = require('node-cron');
const db = require('../config/db');
const logger = require('../config/logger');
const positionManager = require('./positionManager');
const brokerFactory = require('../brokers/brokerFactory');

let monitorTask = null;
let isRunning = false;

/**
 * Start SL/TP monitoring cron job
 */
function start() {
  if (isRunning) {
    logger.warn('⚠️  SL/TP monitor already running');
    return;
  }

  const interval = parseInt(process.env.SLTP_MONITOR_INTERVAL) || 5;
  
  // Run every N seconds
  monitorTask = cron.schedule(`*/${interval} * * * * *`, async () => {
    await monitorPositions();
  });

  isRunning = true;
  logger.info(`✅ SL/TP Monitor started (interval: ${interval}s)`);
}

/**
 * Stop SL/TP monitoring
 */
function stop() {
  if (monitorTask) {
    monitorTask.stop();
    monitorTask = null;
    isRunning = false;
    logger.info('🛑 SL/TP Monitor stopped');
  }
}

/**
 * Monitor all open SL/TP positions
 */
async function monitorPositions() {
  try {
    // Get all open positions with SL/TP enabled
    const positions = await positionManager.getOpenSLTPPositions();

    if (positions.length === 0) {
      return; // Nothing to monitor
    }

    logger.debug(`👀 Monitoring ${positions.length} SL/TP position(s)`);

    // Check each position
    for (const position of positions) {
      await checkPosition(position);
    }

  } catch (error) {
    logger.error('❌ SL/TP monitor error', { error: error.message });
  }
}

/**
 * Check single position against SL/TP
 */
async function checkPosition(position) {
  const { 
    id, 
    userId, 
    side, 
    canonicalSymbol, 
    qty,
    entryPrice,
    slPrice, 
    tpPrice 
  } = position;

  try {
    // Get user's broker credentials
    const [userBroker] = await db.query(
      `SELECT ak.broker, ak.apiKey, ak.apiSecret, ak.segment
       FROM apikeys ak
       WHERE ak.userId = ? AND ak.status = 'Active'
       LIMIT 1`,
      [userId]
    );

    if (!userBroker) {
      logger.warn('⚠️  No active broker found for user', { userId });
      return;
    }

    // Get current LTP
    const brokerAdapter = brokerFactory.getAdapter(userBroker.broker, userBroker);
    const ltp = await brokerAdapter.getLTP(canonicalSymbol);

    logger.debug('LTP Check', { positionId: id, symbol: canonicalSymbol, ltp, slPrice, tpPrice });

    let hitReason = null;

    // Check SL/TP conditions
    if (side === 'LONG') {
      if (slPrice && ltp <= slPrice) {
        hitReason = 'SL';
      } else if (tpPrice && ltp >= tpPrice) {
        hitReason = 'TP';
      }
    } else if (side === 'SHORT') {
      if (slPrice && ltp >= slPrice) {
        hitReason = 'SL';
      } else if (tpPrice && ltp <= tpPrice) {
        hitReason = 'TP';
      }
    }

    // Exit if SL/TP hit
    if (hitReason) {
      logger.info(`🎯 ${hitReason} HIT!`, { 
        positionId: id, 
        userId, 
        side, 
        ltp,
        slPrice,
        tpPrice,
      });

      await exitPositionAtMarket(position, hitReason, userBroker, ltp);
    }

  } catch (error) {
    logger.error('❌ Position check failed', { 
      positionId: position.id, 
      error: error.message 
    });
  }
}

/**
 * Exit position at market price
 */
async function exitPositionAtMarket(position, exitReason, brokerData, ltp) {
  const { id, side, canonicalSymbol, qty } = position;

  try {
    const brokerAdapter = brokerFactory.getAdapter(brokerData.broker, brokerData);

    // Place market exit order
    const order = await brokerAdapter.placeOrder({
      side: side === 'LONG' ? 'SELL' : 'BUY',
      symbol: canonicalSymbol,
      qty,
      orderType: 'MARKET',
    });

    // Close position in DB
    await positionManager.closePosition(id, {
      exitOrderId: order.orderId,
      exitPrice: order.fillPrice || ltp,
      exitReason,
    });

    logger.info('✅ SL/TP exit completed', { 
      positionId: id, 
      exitReason, 
      orderId: order.orderId 
    });

  } catch (error) {
    logger.error('❌ SL/TP exit failed', { 
      positionId: id, 
      error: error.message 
    });
  }
}

module.exports = {
  start,
  stop,
  monitorPositions, // Export for manual testing
};
