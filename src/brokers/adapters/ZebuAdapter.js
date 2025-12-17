/**
 * Zebu Broker Adapter (Indian Markets)
 */

const BaseBrokerAdapter = require('../BaseBrokerAdapter');
const logger = require('../../config/logger');

class ZebuAdapter extends BaseBrokerAdapter {
  constructor(credentials) {
    super(credentials);
    this.userId = credentials.userId || credentials.brokerId;
    this.apiKey = credentials.apiKey;
  }

  async placeOrder(params) {
    const { side, symbol, qty, orderType = 'MARKET' } = params;
    logger.info('📊 Zebu: Placing order', { side, symbol, qty });

    // TODO: Implement Zebu API
    return {
      orderId: `ZEBU_${Date.now()}`,
      status: 'FILLED',
      fillPrice: 21500,
      fillQty: qty,
      fillTime: new Date(),
    };
  }

  async getLTP(symbol) {
    return 21500; // Mock
  }
}

module.exports = ZebuAdapter;
