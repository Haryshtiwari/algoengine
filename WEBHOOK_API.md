# AlgoEngine Webhook API Documentation

## 🌐 Production URL
**Base URL:** `https://api.uptrender.com` or `http://api.uptrender.com`

---

## 📌 Webhook Endpoint (TradingView Integration)

### **POST** `/webhook/tradingview`

**Full URL:** `http://api.uptrender.com/webhook/tradingview`

This endpoint receives signals from TradingView and executes trades for all subscribed users.

---

## 📥 Request Format

### Headers
```http
Content-Type: application/json
X-Webhook-Secret: Uptrender@Algo2025
```

### Request Body (JSON)

#### **Minimal Required Format:**
```json
{
  "strategyId": 10,
  "signal": 1,
  "symbol": "NIFTY"
}
```

#### **Complete Format with All Fields:**
```json
{
  "strategyId": 10,
  "segment": "Indian",
  "symbol": "NIFTY",
  "signal": 1,
  "price": 21500.50,
  "signalId": "TV_2025_12_17_001",
  "timestamp": "2025-12-17T12:30:00Z",
  "metadata": {
    "timeframe": "5m",
    "indicator": "EMA_Cross"
  }
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `strategyId` | integer | ✅ Yes | Strategy ID from `strategies` table |
| `signal` | integer | ✅ Yes | Position signal: `1` = LONG, `-1` = SHORT, `0` = FLAT/EXIT |
| `symbol` | string | ✅ Yes | Trading symbol (canonical format) |
| `segment` | string | ❌ No | Market segment: `Indian`, `Forex`, `Crypto` (auto-resolved from strategy) |
| `price` | number | ❌ No | Current market price (informational) |
| `signalId` | string | ❌ No | Unique signal identifier (for deduplication) |
| `timestamp` | string | ❌ No | ISO timestamp of signal generation |
| `metadata` | object | ❌ No | Additional signal information |

---

## 📤 Response Format

### ✅ Success Response (202 Accepted)
```json
{
  "status": "accepted",
  "signalId": "67617e6f8d4a2f3e1c9b8a7d",
  "strategyId": 10,
  "signal": 1,
  "subscribersCount": 3,
  "message": "Signal processing started for 3 subscribers",
  "timestamp": "2025-12-17T12:30:01.234Z"
}
```

### ❌ Error Responses

#### 400 Bad Request (Missing Fields)
```json
{
  "error": "Missing required fields",
  "required": ["strategyId", "signal", "symbol"],
  "received": {
    "strategyId": 10,
    "signal": 1
  }
}
```

#### 404 Not Found (Invalid Strategy)
```json
{
  "error": "Strategy not found or inactive",
  "strategyId": 999
}
```

#### 409 Conflict (Duplicate Signal)
```json
{
  "error": "Duplicate signal",
  "signalId": "TV_2025_12_17_001",
  "message": "This signal has already been processed"
}
```

#### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "message": "Database connection failed"
}
```

---

## 🎯 Signal Values Explained

| Signal Value | Meaning | Action |
|--------------|---------|--------|
| `1` | **LONG** | Enter/maintain long position |
| `-1` | **SHORT** | Enter/maintain short position |
| `0` | **FLAT/EXIT** | Close all positions (force exit) |

### Execution Logic by Current State

#### When `signal = 1` (Target: LONG)
- **Current FLAT** → Open LONG position
- **Current LONG** → Do nothing (already aligned)
- **Current SHORT** → Close SHORT, then open LONG (reversal)

#### When `signal = -1` (Target: SHORT)
- **Current FLAT** → Open SHORT position
- **Current SHORT** → Do nothing (already aligned)
- **Current LONG** → Close LONG, then open SHORT (reversal)

#### When `signal = 0` (Target: FLAT)
- **Current LONG** → Close LONG position
- **Current SHORT** → Close SHORT position
- **Current FLAT** → Do nothing

---

## 📊 Example TradingView Alert Message

### Pine Script Alert Configuration

```javascript
// Strategy entry/exit conditions
strategy.entry("Long", strategy.long, when = buyCondition)
strategy.entry("Short", strategy.short, when = sellCondition)
strategy.close_all(when = exitCondition)

// Alert for LONG signal
alertcondition(buyCondition, title="Long Signal", 
    message='{"strategyId":10,"signal":1,"symbol":"{{ticker}}","price":{{close}},"timestamp":"{{time}}"}')

// Alert for SHORT signal
alertcondition(sellCondition, title="Short Signal", 
    message='{"strategyId":10,"signal":-1,"symbol":"{{ticker}}","price":{{close}},"timestamp":"{{time}}"}')

// Alert for EXIT signal
alertcondition(exitCondition, title="Exit Signal", 
    message='{"strategyId":10,"signal":0,"symbol":"{{ticker}}","price":{{close}},"timestamp":"{{time}}"}')
```

### TradingView Webhook Setup
1. Create alert on TradingView
2. Set **Webhook URL:** `http://api.uptrender.com/webhook/tradingview`
3. Paste alert message (JSON format above)
4. Enable "Webhook URL" option

---

## 🧪 Testing with cURL

### Test LONG signal
```bash
curl -X POST http://api.uptrender.com/webhook/tradingview \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: Uptrender@Algo2025" \
  -d '{
    "strategyId": 10,
    "signal": 1,
    "symbol": "NIFTY",
    "price": 21500
  }'
```

### Test SHORT signal
```bash
curl -X POST http://api.uptrender.com/webhook/tradingview \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: Uptrender@Algo2025" \
  -d '{
    "strategyId": 10,
    "signal": -1,
    "symbol": "NIFTY",
    "price": 21450
  }'
```

### Test EXIT signal
```bash
curl -X POST http://api.uptrender.com/webhook/tradingview \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: Uptrender@Algo2025" \
  -d '{
    "strategyId": 10,
    "signal": 0,
    "symbol": "NIFTY"
  }'
```

---

## 🔐 Security (Optional)

### Add Webhook Secret
Secret is already configured in production:
```
X-Webhook-Secret: Uptrender@Algo2025
```

Include this header in all TradingView webhook requests.

---

## 📈 Per-User Behavior

### Example Scenario
**Signal received:** `signal = 1` (LONG) for `strategyId = 10`

**Subscribers:**
- **User A**: No position → Opens LONG (100 qty)
- **User B**: Already LONG → Does nothing
- **User C**: SHORT position → Closes SHORT, Opens LONG (reversal, 50 qty)
- **User D**: Has custom SL/TP → Opens LONG (75 qty) + SL/TP monitoring starts

**Response:**
```json
{
  "status": "accepted",
  "subscribersCount": 4,
  "message": "Signal processing started for 4 subscribers"
}
```

### Per-User SL/TP
- Users with `slEnabled=1` or `tpEnabled=1` → Independent exit monitoring
- Users without SL/TP → Wait for next signal to exit
- **Signal 0** → Force exits everyone (including SL/TP users)

---

## 🏥 Health Check Endpoint

### **GET** `/health`
**URL:** `http://api.uptrender.com/health`

**Response:**
```json
{
  "status": "ok",
  "service": "algoengine",
  "version": "1.0.0",
  "timestamp": "2025-12-17T12:30:00Z"
}
```

---

## 📊 Monitoring & Logs

### Check PM2 Status
```bash
pm2 status algoengine
pm2 logs algoengine
```

### Database Verification
```sql
-- Check signal logs
SELECT * FROM signal_logs ORDER BY receivedAt DESC LIMIT 10;

-- Check positions
SELECT * FROM positions WHERE status='OPEN';

-- Check execution logs
SELECT * FROM execution_logs ORDER BY createdAt DESC LIMIT 20;
```

---

## 🚨 Common Issues & Troubleshooting

### Issue: "Strategy not found"
- ✅ Verify `strategyId` exists in `strategies` table
- ✅ Check `isActive = 1` in strategies

### Issue: "No active subscribers"
- ✅ Check `StrategySubscriptions` table
- ✅ Ensure `isActive = 1` for subscriptions
- ✅ Verify users have active API keys in `apikeys` table

### Issue: Duplicate signals
- ✅ Use unique `signalId` in each webhook
- ✅ Check `signal_logs` table for existing signalId

---

## 📞 Support

- **GitHub:** https://github.com/Haryshtiwari/algoengine
- **Logs:** `/var/www/Algoengine/logs/`
- **PM2 Logs:** `pm2 logs algoengine`

---

**Last Updated:** December 17, 2025  
**Version:** 1.0.0
