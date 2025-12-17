# 🚀 AlgoEngine Quick Reference

## 📡 Live Production URL
```
http://api.uptrender.com
```

---

## 🎯 Main Webhook Endpoint

### TradingView Webhook URL (Copy This)
```
http://api.uptrender.com/webhook/tradingview
```

---

## 📝 Quick Signal Format

### Minimal (Copy & Paste in TradingView)
```json
{"strategyId":10,"signal":1,"symbol":"{{ticker}}","price":{{close}}}
```

### Signal Values
- `1` = LONG (buy)
- `-1` = SHORT (sell)  
- `0` = EXIT (close all)

---

## 🧪 Test Commands

### Test LONG
```bash
curl -X POST http://api.uptrender.com/webhook/tradingview \
  -H "Content-Type: application/json" \
  -d '{"strategyId":10,"signal":1,"symbol":"NIFTY"}'
```

### Test SHORT
```bash
curl -X POST http://api.uptrender.com/webhook/tradingview \
  -H "Content-Type: application/json" \
  -d '{"strategyId":10,"signal":-1,"symbol":"NIFTY"}'
```

### Test EXIT
```bash
curl -X POST http://api.uptrender.com/webhook/tradingview \
  -H "Content-Type: application/json" \
  -d '{"strategyId":10,"signal":0,"symbol":"NIFTY"}'
```

### Health Check
```bash
curl http://api.uptrender.com/health
```

---

## 📤 Response Examples

### ✅ Success
```json
{
  "status": "accepted",
  "signalId": "...",
  "subscribersCount": 3
}
```

### ❌ Error
```json
{
  "error": "Strategy not found",
  "strategyId": 999
}
```

---

## 🔍 Quick Debug

### Check Server Status
```bash
pm2 status algoengine
pm2 logs algoengine --lines 50
```

### Check Database
```sql
-- Recent signals
SELECT * FROM signal_logs ORDER BY receivedAt DESC LIMIT 5;

-- Open positions
SELECT userId, strategyId, side, qty FROM positions WHERE status='OPEN';

-- Recent executions
SELECT * FROM execution_logs ORDER BY createdAt DESC LIMIT 10;
```

---

## ⚡ PM2 Commands
```bash
pm2 restart algoengine    # Restart
pm2 stop algoengine       # Stop
pm2 start algoengine      # Start
pm2 delete algoengine     # Remove
pm2 logs algoengine       # View logs
```

---

## 📊 File Locations
- **Code:** `/var/www/Algoengine/`
- **Logs:** `/var/www/Algoengine/logs/`
- **Config:** `/var/www/Algoengine/.env`
- **Nginx:** `/etc/nginx/conf.d/api.uptrender.com.conf`

---

## 🔗 Links
- **Full API Docs:** [WEBHOOK_API.md](./WEBHOOK_API.md)
- **Setup Guide:** [SETUP_COMPLETE.md](./SETUP_COMPLETE.md)
- **GitHub:** https://github.com/Haryshtiwari/algoengine
