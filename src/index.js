/**
 * AlgoEngine - Main Server
 * Multi-user webhook-based trading engine
 */

require('dotenv').config();

const express = require('express');
const logger = require('./config/logger');
const db = require('./config/db');
const webhookRoutes = require('./routes/webhook');
const adminRoutes = require('./routes/admin');
const sltpMonitor = require('./services/sltpMonitor');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, { 
    ip: req.ip, 
    userAgent: req.headers['user-agent'] 
  });
  next();
});

// Routes
app.use('/webhook', webhookRoutes);
app.use('/admin', adminRoutes);  // Admin dashboard
app.use('/logs', adminRoutes);   // Alias for logs page
app.use('/admin', adminRoutes);

// Root redirect to admin
app.get('/', (req, res) => {
  res.redirect('/admin');
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'algoengine',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown
async function shutdown() {
  logger.info('🛑 Shutting down gracefully...');
  
  // Stop SL/TP monitor
  sltpMonitor.stop();
  
  // Close database connections
  await db.closeDB();
  
  logger.info('✅ Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
async function start() {
  try {
    // Initialize database
    await db.initDB();
    logger.info('✅ Database initialized');

    // Start SL/TP monitor
    sltpMonitor.start();

    // Start Express server
    app.listen(PORT, () => {
      logger.info(`🚀 AlgoEngine server running on port ${PORT}`);
      logger.info(`📥 Webhook endpoint: http://localhost:${PORT}/webhook/tradingview`);
      logger.info(`💚 Health check: http://localhost:${PORT}/health`);
    });

  } catch (error) {
    logger.error('❌ Failed to start server', { error: error.message });
    process.exit(1);
  }
}

// Start the engine
start();
