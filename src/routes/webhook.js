/**
 * Webhook Routes
 * Handles incoming TradingView webhook signals
 */

const express = require('express');
const router = express.Router();
const logger = require('../config/logger');
const signalService = require('../services/signalService');
const executionService = require('../services/executionService');

/**
 * POST /webhook/tradingview
 * Receives signal from TradingView: { strategyId, signal, symbol, signalId, timestamp, ... }
 */
router.post('/tradingview', async (req, res) => {
  try {
    const payload = req.body;
    logger.info('📥 Webhook received', { payload });

    // Validate webhook secret (basic auth)
    const providedSecret = req.headers['x-webhook-secret'] || req.body.secret;
    if (providedSecret !== process.env.WEBHOOK_SECRET) {
      logger.warn('⚠️  Unauthorized webhook attempt', { ip: req.ip });
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate required fields
    const { strategyId, signal, symbol } = payload;
    if (!strategyId || signal === undefined || !symbol) {
      logger.warn('⚠️  Invalid webhook payload', { payload });
      return res.status(400).json({ 
        error: 'Missing required fields: strategyId, signal, symbol' 
      });
    }

    // Validate signal value
    if (![1, 0, -1].includes(signal)) {
      logger.warn('⚠️  Invalid signal value', { signal });
      return res.status(400).json({ 
        error: 'Signal must be 1 (LONG), 0 (FLAT), or -1 (SHORT)' 
      });
    }

    // Quick response (process asynchronously)
    res.status(202).json({ 
      status: 'accepted',
      message: 'Signal processing started',
      signalId: payload.signalId || 'auto-generated'
    });

    // Process signal asynchronously (non-blocking)
    setImmediate(async () => {
      try {
        // 1. Log and dedupe signal
        const signalLog = await signalService.logSignal(payload);
        
        if (!signalLog) {
          logger.info('ℹ️  Signal already processed (duplicate)', { payload });
          return;
        }

        // 2. Execute for all subscribers
        await executionService.executeForSignal(signalLog);
        
        logger.info('✅ Signal processed successfully', { 
          signalLogId: signalLog.id,
          strategyId 
        });

      } catch (error) {
        logger.error('❌ Signal processing failed', { 
          payload, 
          error: error.message,
          stack: error.stack 
        });
      }
    });

  } catch (error) {
    logger.error('❌ Webhook handler error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /webhook/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'algoengine-webhook',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
