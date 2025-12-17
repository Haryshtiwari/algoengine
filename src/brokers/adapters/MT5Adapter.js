/**
 * MT5 Broker Adapter (Forex)
 * MetaTrader 5 integration stub
 */

const BaseBrokerAdapter = require('../BaseBrokerAdapter');
const logger = require('../../config/logger');

class MT5Adapter extends BaseBrokerAdapter {
  constructor(credentials) {
    super(credentials);
    this.accountId = credentials.accountId || credentials.apiKey;
    this.password = credentials.password || credentials.apiSecret;
    this.server = credentials.server || 'MT5-Demo';
  }

  async placeOrder(params) {
    const { side, symbol, qty, orderType = 'MARKET' } = params;

    logger.info('📊 MT5: Placing order', { side, symbol, qty, orderType });

    // TODO: Implement MT5 REST/WebSocket API integration
    // Options: MetaApi, cTrader API, or custom MT5 bridge

    return {
      orderId: `MT5_${Date.now()}`,
      status: 'FILLED',
      fillPrice: 1.0850, // Mock EUR/USD price
      fillQty: qty,
      fillTime: new Date(),
    };
  }

  async getLTP(symbol) {
    logger.info('📊 MT5: Getting LTP', { symbol });
    // TODO: Implement tick data fetch
    return 1.0850; // Mock
  }

  normalizeSymbol(canonicalSymbol) {
    // FX:EUR/USD -> EURUSD
    return canonicalSymbol.replace('FX:', '').replace('/', '');
  }
}

module.exports = MT5Adapter;
