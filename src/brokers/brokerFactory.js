/**
 * Broker Factory
 * Returns appropriate broker adapter based on broker name
 */

const logger = require('../config/logger');

// Import broker adapters
const BinanceAdapter = require('./adapters/BinanceAdapter');
const MT5Adapter = require('./adapters/MT5Adapter');
const AngelOneAdapter = require('./adapters/AngelOneAdapter');
const AliceBlueAdapter = require('./adapters/AliceBlueAdapter');
const ZebuAdapter = require('./adapters/ZebuAdapter');
const DeltaExchangeAdapter = require('./adapters/DeltaExchangeAdapter');
const DerivAdapter = require('./adapters/DerivAdapter');

// Broker registry
const BROKER_ADAPTERS = {
  'Binance': BinanceAdapter,
  'MT5': MT5Adapter,
  'AngelOne': AngelOneAdapter,
  'Angel One': AngelOneAdapter,
  'AliceBlue': AliceBlueAdapter,
  'Zebu': ZebuAdapter,
  'DeltaExchange': DeltaExchangeAdapter,
  'Delta': DeltaExchangeAdapter,
  'Deriv': DerivAdapter,
};

/**
 * Get broker adapter instance
 */
function getAdapter(brokerName, credentials) {
  const AdapterClass = BROKER_ADAPTERS[brokerName];

  if (!AdapterClass) {
    logger.warn(`⚠️  Unsupported broker: ${brokerName}, using mock adapter`);
    return new MockAdapter(brokerName, credentials);
  }

  return new AdapterClass(credentials);
}

/**
 * Mock Adapter (for testing / unsupported brokers)
 */
class MockAdapter {
  constructor(brokerName, credentials) {
    this.brokerName = brokerName;
    this.credentials = credentials;
  }

  async placeOrder(params) {
    logger.info(`🎭 MOCK: Placing order on ${this.brokerName}`, params);
    
    // Simulate order response
    return {
      orderId: `MOCK_${Date.now()}`,
      status: 'FILLED',
      fillPrice: params.price || 100.00,
      fillQty: params.qty,
      fillTime: new Date(),
    };
  }

  async getLTP(symbol) {
    logger.info(`🎭 MOCK: Getting LTP for ${symbol} on ${this.brokerName}`);
    return Math.random() * 1000 + 500; // Random price
  }

  async cancelOrder(orderId) {
    logger.info(`🎭 MOCK: Cancelling order ${orderId} on ${this.brokerName}`);
    return { success: true };
  }
}

module.exports = {
  getAdapter,
};
