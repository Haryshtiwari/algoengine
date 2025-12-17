/**
 * Base Broker Adapter
 * Abstract class that all broker adapters must extend
 */

class BaseBrokerAdapter {
  constructor(credentials) {
    this.credentials = credentials;
  }

  /**
   * Place an order
   * @param {Object} params - { side: 'BUY'|'SELL', symbol, qty, orderType: 'MARKET'|'LIMIT', price? }
   * @returns {Promise<Object>} - { orderId, status, fillPrice, fillQty, fillTime }
   */
  async placeOrder(params) {
    throw new Error('placeOrder() must be implemented by subclass');
  }

  /**
   * Get Last Traded Price
   * @param {string} symbol
   * @returns {Promise<number>}
   */
  async getLTP(symbol) {
    throw new Error('getLTP() must be implemented by subclass');
  }

  /**
   * Cancel an order
   * @param {string} orderId
   * @returns {Promise<Object>}
   */
  async cancelOrder(orderId) {
    throw new Error('cancelOrder() must be implemented by subclass');
  }

  /**
   * Get open positions (optional)
   */
  async getPositions() {
    return [];
  }

  /**
   * Normalize symbol from canonical to broker-specific format
   */
  normalizeSymbol(canonicalSymbol) {
    return canonicalSymbol; // Override in subclass if needed
  }
}

module.exports = BaseBrokerAdapter;
