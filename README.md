# AlgoEngine — Multi-User Webhook-Based Trading System

> TradingView signal → Multi-user execution → Multi-broker support → Per-user SL/TP

## 🎯 Features

- **Webhook-Driven**: Receives signals from TradingView (or any webhook source)
- **Multi-User Execution**: One signal → executes for all strategy subscribers with their config
- **Multi-Broker Support**: MT5, Binance, Angel One, AliceBlue, Zebu, Delta Exchange, Deriv
- **Per-User Quantities**: Each user trades with their own fixed quantity
- **Per-User SL/TP**: Independent stop-loss and take-profit for each subscriber
- **Signal Types**: `1` (LONG), `-1` (SHORT), `0` (FORCE EXIT/FLAT)
- **Position Reversal**: Automatic square-off + reverse on opposite signals
- **Real-time Monitoring**: Background SL/TP monitor checks positions every N seconds
- **Segments Supported**: Indian (NSE/BSE), Forex (MT5), Crypto (Binance/Delta)

---

## 📦 Installation

### Prerequisites

- **Node.js** >= 16.x
- **MySQL** >= 8.0
- **Linux/macOS** (tested on Ubuntu/CentOS)

### Setup Steps

```bash
# 1. Clone/navigate to project
cd /var/www/Algoengine

# 2. Install dependencies
npm install

# 3. Configure environment (edit .env file)
cp .env.example .env
nano .env  # Set DB credentials: Quants / Quants@4897

# 4. Import database + run migrations
npm run db:setup

# 5. Start server
npm start

# OR for development with auto-reload
npm run dev
```

---

## ⚙️ Environment Variables

Edit `.env` file:

```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=Quants
DB_PASSWORD=Quants@4897
DB_NAME=algo_trading_db

# Server
PORT=3000
NODE_ENV=development

# Webhook Security
WEBHOOK_SECRET=your_secret_here_change_in_production

# SL/TP Monitor
SLTP_MONITOR_INTERVAL=5  # seconds

# Logging
LOG_LEVEL=info
LOG_FILE=logs/algoengine.log
```

---

## 📊 Database Schema

### Tables Added by Migration (`001_add_algo_engine_tables.sql`)

| Table                     | Purpose                                              |
|---------------------------|------------------------------------------------------|
| `positions`               | Track open/closed positions per user-strategy       |
| `signal_logs`             | Webhook signal history + deduplication               |
| `execution_logs`          | Per-user execution decisions (ENTER/EXIT/REVERSE)    |
| `instrument_mappings`     | Canonical symbol → broker-specific symbol/token      |
| `order_logs`              | Broker order request/response audit trail            |
| `StrategySubscriptions`   | **ALTERED**: Added `qty`, `slEnabled`, `tpEnabled`, etc. |

### Key Fields in `StrategySubscriptions` (per user config)

- `qty` — Fixed quantity to execute (overrides `lots` if set)
- `slEnabled`, `slType`, `slValue` — Stop-loss config (POINTS/PERCENT)
- `tpEnabled`, `tpType`, `tpValue` — Take-profit config
- `exitMode` — `SIGNAL_ONLY` (exit on opposite signal) or `SLTP` (exit via SL/TP monitor)

---

## 🔗 TradingView Webhook Setup

### 1. Create Alert in TradingView

- **Condition**: Your strategy (e.g., MA crossover)
- **Message** (JSON payload):

```json
{
  "strategyId": 10,
  "signal": 1,
  "symbol": "BTC/USDT",
  "segment": "Crypto",
  "signalId": "{{timenow}}",
  "timestamp": "{{timenow}}",
  "secret": "your_webhook_secret_here"
}
```

### 2. Webhook URL

```
http://your-server-ip:3000/webhook/tradingview
```

### 3. Signal Values

- **`1`** → LONG (buy signal)
- **`-1`** → SHORT (sell signal)
- **`0`** → FLAT (force exit all positions, including SL/TP users)

---

## 🚀 API Endpoints

### `POST /webhook/tradingview`

**Headers:**
```
Content-Type: application/json
X-Webhook-Secret: your_webhook_secret_here
```

**Body:**
```json
{
  "strategyId": 10,
  "signal": 1,
  "symbol": "NIFTY",
  "segment": "Indian",
  "signalId": "unique-signal-id",
  "timestamp": 1734390000
}
```

**Response (202 Accepted):**
```json
{
  "status": "accepted",
  "message": "Signal processing started",
  "signalId": "unique-signal-id"
}
```

### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "algoengine",
  "version": "1.0.0",
  "timestamp": "2025-12-17T10:30:00.000Z"
}
```

---

## 📈 Execution Logic Summary

### For Each Signal Received:

1. **Dedupe**: Check `signal_logs` for duplicate `signalId`/`payloadHash`
2. **Fetch Subscribers**: Query all active users subscribed to `strategyId`
3. **Per-User State Reconciliation**:
   
   | Current State | Target State (Signal) | Action                                    |
   |---------------|-----------------------|-------------------------------------------|
   | FLAT          | LONG (1)              | **ENTER** LONG                            |
   | FLAT          | SHORT (-1)            | **ENTER** SHORT                           |
   | FLAT          | FLAT (0)              | **SKIP** (no position)                    |
   | LONG          | LONG (1)              | **SKIP** (already in target)              |
   | LONG          | SHORT (-1)            | **REVERSE** (square-off + enter SHORT)    |
   | LONG          | FLAT (0)              | **EXIT** (force square-off)               |
   | SHORT         | SHORT (-1)            | **SKIP** (already in target)              |
   | SHORT         | LONG (1)              | **REVERSE** (square-off + enter LONG)     |
   | SHORT         | FLAT (0)              | **EXIT** (force square-off)               |

4. **Broker Execution**: Place orders via user's broker adapter
5. **Log**: Store in `execution_logs`, `positions`, `order_logs`

### SL/TP Users (exitMode = 'SLTP')

- **Independent exits**: Monitored by background worker every `SLTP_MONITOR_INTERVAL` seconds
- **Signal 0 force-exits** SL/TP users too (confirmed rule)
- Reversals (1 ↔ -1) apply to SL/TP users as well (your final decision)

---

## 🛠️ Broker Adapters

### Supported Brokers (Stub Implementations)

| Broker           | Segment     | Status      | Notes                                      |
|------------------|-------------|-------------|--------------------------------------------|
| **Binance**      | Crypto      | Stub ready  | Implement REST API for production          |
| **MT5**          | Forex       | Stub ready  | Requires MetaApi or custom bridge          |
| **Angel One**    | Indian      | Stub ready  | SmartAPI integration needed                |
| **AliceBlue**    | Indian      | Stub ready  | API docs: aliceblueonline.com              |
| **Zebu**         | Indian      | Stub ready  | API docs: zebull.in                        |
| **DeltaExchange**| Crypto      | Stub ready  | REST API for crypto derivatives            |
| **Deriv**        | Forex/Synth | Stub ready  | WebSocket-based API                        |

### How to Implement a Broker

1. Extend `BaseBrokerAdapter` in `src/brokers/adapters/YourBroker.js`
2. Implement required methods:
   - `placeOrder(params)` → Place market/limit orders
   - `getLTP(symbol)` → Fetch last traded price
   - `cancelOrder(orderId)` (optional)
   - `normalizeSymbol(canonicalSymbol)` (optional)

3. Register in `brokerFactory.js`:
```javascript
const YourBrokerAdapter = require('./adapters/YourBrokerAdapter');
BROKER_ADAPTERS['YourBroker'] = YourBrokerAdapter;
```

---

## 📝 Logs

Logs are written to:
- **Console** (colored output)
- **File**: `logs/algoengine.log` (rotating, max 10MB × 5 files)
- **Errors**: `logs/error.log` (separate error log)

Log levels: `error`, `warn`, `info`, `debug`

---

## 🧪 Testing

### Manual Test (Mock Orders)

All broker adapters currently return **mock responses** for testing.

```bash
# Start server
npm start

# Send test webhook
curl -X POST http://localhost:3000/webhook/tradingview \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: change_this_secret_in_production" \
  -d '{
    "strategyId": 10,
    "signal": 1,
    "symbol": "NIFTY",
    "segment": "Indian",
    "signalId": "test-123"
  }'
```

Check logs:
```bash
tail -f logs/algoengine.log
```

---

## 🗂️ Project Structure

```
/var/www/Algoengine/
├── migrations/
│   └── 001_add_algo_engine_tables.sql  # DB schema additions
├── scripts/
│   ├── setup-db.js                     # Import + migrate DB
│   └── migrate.js                      # Migration runner
├── src/
│   ├── config/
│   │   ├── db.js                       # MySQL connection pool
│   │   └── logger.js                   # Winston logger
│   ├── brokers/
│   │   ├── BaseBrokerAdapter.js        # Base class
│   │   ├── brokerFactory.js            # Broker registry
│   │   └── adapters/
│   │       ├── BinanceAdapter.js
│   │       ├── MT5Adapter.js
│   │       ├── AngelOneAdapter.js
│   │       ├── AliceBlueAdapter.js
│   │       ├── ZebuAdapter.js
│   │       ├── DeltaExchangeAdapter.js
│   │       └── DerivAdapter.js
│   ├── services/
│   │   ├── signalService.js            # Webhook logging + dedupe
│   │   ├── executionService.js         # Core execution engine
│   │   ├── positionManager.js          # Position CRUD
│   │   └── sltpMonitor.js              # Background SL/TP worker
│   ├── routes/
│   │   └── webhook.js                  # Webhook endpoints
│   └── index.js                        # Main server
├── logs/                               # Log files (gitignored)
├── .env                                # Environment config (gitignored)
├── .env.example                        # Example env file
├── .gitignore
├── package.json
├── project.md                          # Original requirements doc
└── README.md                           # This file
```

---

## 🚨 Important Notes

### Security

- **Change `WEBHOOK_SECRET`** in production
- **Never commit `.env`** file to git
- Use **SSL/HTTPS** for webhook endpoint in production
- Implement **IP whitelisting** if needed (TradingView IPs)

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure broker API credentials in `apikeys` table per user
- [ ] Implement real broker API calls (remove mock stubs)
- [ ] Set up SSL certificate (nginx reverse proxy recommended)
- [ ] Configure log rotation and monitoring (PM2, systemd)
- [ ] Test with paper trading first
- [ ] Set up database backups
- [ ] Monitor system resources (CPU/RAM/Network)

### Database Maintenance

```bash
# Backup database
mysqldump -u Quants -p algo_trading_db > backup_$(date +%Y%m%d).sql

# Archive old logs (positions, signal_logs older than 30 days)
# Create scheduled job for cleanup
```

---

## 📞 Support

For issues or questions:
- Check logs: `logs/algoengine.log`
- Review `execution_logs` table for per-user decisions
- Check `order_logs` for broker errors

---

## 📄 License

MIT License

---

## 🎉 Quick Start Commands

```bash
# Setup
cd /var/www/Algoengine
npm install
npm run db:setup

# Start
npm start

# Dev mode
npm run dev

# Logs
tail -f logs/algoengine.log

# Test webhook
curl -X POST http://localhost:3000/webhook/tradingview \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: change_this_secret_in_production" \
  -d '{"strategyId":10,"signal":1,"symbol":"NIFTY"}'
```

---

**Happy Trading! 🚀📈**
