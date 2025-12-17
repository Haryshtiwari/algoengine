# 🎉 AlgoEngine Production Deployment Complete!

## ✅ Deployment Summary

Your multi-user algo trading engine is now **LIVE** on production!

---

## 🌐 Production URLs

### Main Webhook Endpoint (TradingView)
```
http://api.uptrender.com/webhook/tradingview
```

### Health Check
```
http://api.uptrender.com/health
```

### Base API URL
```
http://api.uptrender.com
```

---

## 🔐 Authentication

### Webhook Secret (Required for all webhook calls)
```
X-Webhook-Secret: Uptrender@Algo2025
```

**Important:** Include this header in every TradingView webhook request.

---

## 📝 Quick Start: TradingView Integration

### Step 1: Create Alert in TradingView

1. Open your strategy on TradingView
2. Click **Create Alert** (alarm icon)
3. Configure alert settings

### Step 2: Webhook Configuration

**Webhook URL:**
```
http://api.uptrender.com/webhook/tradingview
```

**Alert Message (JSON):**
```json
{"strategyId":10,"signal":1,"symbol":"{{ticker}}","price":{{close}}}
```

### Step 3: Alert Message for Different Signals

#### LONG Signal (Buy)
```json
{"strategyId":10,"signal":1,"symbol":"{{ticker}}","price":{{close}},"timestamp":"{{time}}"}
```

#### SHORT Signal (Sell)
```json
{"strategyId":10,"signal":-1,"symbol":"{{ticker}}","price":{{close}},"timestamp":"{{time}}"}
```

#### EXIT Signal (Close All)
```json
{"strategyId":10,"signal":0,"symbol":"{{ticker}}","price":{{close}},"timestamp":"{{time}}"}
```

**Note:** Replace `strategyId` with your actual strategy ID from database.

---

## 📤 Expected Responses

### ✅ Success Response
```json
{
  "status": "accepted",
  "message": "Signal processing started",
  "signalId": "67617e6f8d4a2f3e1c9b8a7d",
  "strategyId": 10,
  "signal": 1,
  "subscribersCount": 3,
  "timestamp": "2025-12-17T19:30:01.234Z"
}
```

**What this means:**
- ✅ Signal accepted successfully
- ✅ Processing started for 3 subscribed users
- ✅ Each user will have trades executed based on their config

### ❌ Error Response Examples

#### Missing Authentication
```json
{
  "error": "Unauthorized"
}
```
**Fix:** Add `X-Webhook-Secret: Uptrender@Algo2025` header

#### Missing Required Fields
```json
{
  "error": "Missing required fields",
  "required": ["strategyId", "signal", "symbol"]
}
```
**Fix:** Ensure all required fields are in JSON payload

#### Strategy Not Found
```json
{
  "error": "Strategy not found or inactive",
  "strategyId": 999
}
```
**Fix:** Verify strategyId exists and is active in database

#### No Active Subscribers
```json
{
  "status": "skipped",
  "message": "No active subscribers found",
  "strategyId": 10
}
```
**Fix:** Check `StrategySubscriptions` table for active users

---

## 🧪 Testing Commands

### Test LONG Signal
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

### Test SHORT Signal
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

### Test EXIT Signal
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

### Health Check
```bash
curl http://api.uptrender.com/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "service": "algoengine",
  "version": "1.0.0",
  "timestamp": "2025-12-17T19:30:00.000Z"
}
```

---

## 🎯 Signal Values Reference

| Value | Meaning | User Action |
|-------|---------|-------------|
| `1` | **LONG** | Opens long position or maintains if already long |
| `-1` | **SHORT** | Opens short position or maintains if already short |
| `0` | **FLAT/EXIT** | Closes all positions (force exit for everyone) |

### Execution Logic

#### Current Position: FLAT (No position)
- Signal `1` → Opens LONG
- Signal `-1` → Opens SHORT
- Signal `0` → Does nothing

#### Current Position: LONG
- Signal `1` → Does nothing (already aligned)
- Signal `-1` → Closes LONG + Opens SHORT (reversal)
- Signal `0` → Closes LONG (force exit)

#### Current Position: SHORT
- Signal `1` → Closes SHORT + Opens LONG (reversal)
- Signal `-1` → Does nothing (already aligned)
- Signal `0` → Closes SHORT (force exit)

---

## 📊 Per-User Features

### Multi-User Execution
- Same webhook signal → executes for **all subscribed users**
- Each user has independent position state
- Each user has their own quantity (from DB config)

### Per-User SL/TP
- Users can set custom Stop Loss and Take Profit levels
- SL/TP exits happen independently
- Signal `0` force-exits even SL/TP users

### Example Scenario
**Webhook:** `signal=1` (LONG) for Strategy ID 10

**Users:**
- User A (qty=100, no SL/TP) → Opens LONG 100 qty
- User B (qty=50, SL=2%, TP=5%) → Opens LONG 50 qty + monitors SL/TP
- User C (already LONG) → Does nothing
- User D (SHORT 75 qty) → Closes SHORT + Opens LONG (reversal)

**Response:**
```json
{
  "status": "accepted",
  "subscribersCount": 4,
  "message": "Signal processing started for 4 subscribers"
}
```

---

## 🔍 Monitoring & Debugging

### Check Server Status
```bash
pm2 status algoengine
pm2 logs algoengine --lines 50
```

### View Recent Logs
```bash
tail -f /var/www/Algoengine/logs/algoengine.log
```

### Database Verification

#### Check Recent Signals
```sql
SELECT * FROM signal_logs 
ORDER BY receivedAt DESC 
LIMIT 10;
```

#### Check Open Positions
```sql
SELECT 
  p.id, p.userId, p.strategyId, p.side, 
  p.qty, p.entryPrice, p.createdAt 
FROM positions p 
WHERE p.status='OPEN';
```

#### Check Execution Logs
```sql
SELECT 
  e.userId, e.strategyId, e.decision, 
  e.reason, e.createdAt 
FROM execution_logs e 
ORDER BY e.createdAt DESC 
LIMIT 20;
```

#### Check Subscriber Config
```sql
SELECT 
  ss.userId, ss.strategyId, ss.qty, 
  ss.slEnabled, ss.tpEnabled, ss.isActive
FROM StrategySubscriptions ss
WHERE ss.strategyId = 10 AND ss.isActive = 1;
```

---

## 🚨 Troubleshooting

### Problem: Unauthorized Error
**Solution:** Add header `X-Webhook-Secret: Uptrender@Algo2025`

### Problem: Strategy Not Found
**Solution:** Check strategy exists and `isActive=1`
```sql
SELECT id, name, isActive FROM strategies WHERE id=10;
```

### Problem: No Subscribers
**Solution:** Verify active subscriptions
```sql
SELECT * FROM StrategySubscriptions WHERE strategyId=10 AND isActive=1;
```

### Problem: Trades Not Executing
**Check:**
1. Users have valid API keys in `apikeys` table
2. Broker adapter is implemented
3. Check execution_logs for errors
4. Review PM2 logs: `pm2 logs algoengine`

---

## 📁 Server Information

### Project Location
```
/var/www/Algoengine/
```

### Important Files
- **Main Server:** `src/index.js`
- **Webhook Route:** `src/routes/webhook.js`
- **Config:** `.env`
- **Logs:** `logs/algoengine.log`
- **Nginx Config:** `/etc/nginx/conf.d/api.uptrender.com.conf`

### PM2 Process
- **Process Name:** `algoengine`
- **Port:** `3002`
- **Mode:** `cluster`
- **Status:** `online ✅`

### Nginx Reverse Proxy
- **Domain:** `api.uptrender.com`
- **Backend:** `localhost:3002`
- **Protocol:** `HTTP` (add SSL later if needed)

---

## 📚 Documentation Files

1. **WEBHOOK_API.md** - Complete API documentation
2. **QUICK_REFERENCE.md** - Quick command reference
3. **SETUP_COMPLETE.md** - Initial setup summary
4. **README.md** - Project overview
5. **DEPLOYMENT.md** - This file (production guide)

---

## 🔗 Links

- **GitHub Repository:** https://github.com/Haryshtiwari/algoengine
- **Production URL:** http://api.uptrender.com
- **Health Check:** http://api.uptrender.com/health

---

## 🎊 Final URL Summary

### For TradingView Webhook:
```
POST http://api.uptrender.com/webhook/tradingview
Header: X-Webhook-Secret: Uptrender@Algo2025
Body: {"strategyId":10,"signal":1,"symbol":"NIFTY"}
```

### Expected Response:
```json
{
  "status": "accepted",
  "message": "Signal processing started",
  "subscribersCount": 3
}
```

---

**🚀 Your AlgoEngine is now LIVE and ready to receive TradingView signals!**

**Deployed:** December 17, 2025  
**Version:** 1.0.0  
**Status:** ✅ Production Ready
