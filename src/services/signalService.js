/**
 * Signal Service
 * Handles webhook signal logging and deduplication
 */

const crypto = require('crypto');
const db = require('../config/db');
const logger = require('../config/logger');

/**
 * Log incoming signal and check for duplicates
 * Returns signalLog object if new, null if duplicate
 */
async function logSignal(payload) {
  const { strategyId, signal, symbol, signalId, segment } = payload;

  // Generate unique identifier
  const finalSignalId = signalId || generateSignalId(payload);
  const payloadHash = generateHash(payload);

  try {
    // Check if signal already processed (dedupe)
    const existing = await db.query(
      'SELECT id FROM signal_logs WHERE signalId = ? OR payloadHash = ? LIMIT 1',
      [finalSignalId, payloadHash]
    );

    if (existing.length > 0) {
      logger.info('🔁 Duplicate signal detected', { signalId: finalSignalId });
      return null; // Already processed
    }

    // Fetch strategy details to get segment
    const [strategy] = await db.query(
      'SELECT segment, symbol AS canonicalSymbol FROM strategies WHERE id = ?',
      [strategyId]
    );

    if (!strategy) {
      throw new Error(`Strategy ${strategyId} not found`);
    }

    // Insert signal log
    const result = await db.query(
      `INSERT INTO signal_logs 
        (strategyId, segment, canonicalSymbol, \`signal\`, signalId, payloadHash, payload, receivedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        strategyId,
        segment || strategy.segment,
        symbol || strategy.canonicalSymbol,
        signal,
        finalSignalId,
        payloadHash,
        JSON.stringify(payload),
      ]
    );

    const signalLog = {
      id: result.insertId,
      strategyId,
      segment: segment || strategy.segment,
      canonicalSymbol: symbol || strategy.canonicalSymbol,
      signal,
      signalId: finalSignalId,
    };

    logger.info('📝 Signal logged', signalLog);
    return signalLog;

  } catch (error) {
    logger.error('❌ Failed to log signal', { error: error.message, payload });
    throw error;
  }
}

/**
 * Generate unique signal ID from payload
 */
function generateSignalId(payload) {
  const { strategyId, signal, timestamp } = payload;
  const ts = timestamp || Date.now();
  return `${strategyId}_${signal}_${ts}`;
}

/**
 * Generate SHA256 hash of payload for deduplication
 */
function generateHash(payload) {
  const normalized = JSON.stringify({
    strategyId: payload.strategyId,
    signal: payload.signal,
    symbol: payload.symbol,
    timestamp: payload.timestamp || Math.floor(Date.now() / 60000), // 1-min window
  });
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

module.exports = {
  logSignal,
};
