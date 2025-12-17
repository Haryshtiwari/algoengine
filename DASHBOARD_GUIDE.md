# 🎉 AlgoEngine Dashboard — Live Activity Monitor

## ✅ Dashboard Successfully Deployed!

Your real-time activity monitoring dashboard is now **LIVE** and accessible!

---

## 🌐 **Access Dashboard**

### **Direct IP Access (Working Now):**
```
http://31.97.60.221:3002/logs
```

### **Alternative URLs:**
```
http://31.97.60.221:3002/admin
http://localhost:3002/logs  (from server)
```

---

## 📊 **Dashboard Sections**

### **1. Statistics Cards (Top)**
Real-time counts updated every 10 seconds:

- **Today's Signals** — Webhook signals received today
- **Today's Executions** — User executions processed today  
- **Open Positions** — Currently active positions
- **Active Users Today** — Unique users with activity
- **Closed Today** — Positions closed today

### **2. Recent Webhook Signals (Last 50)**
Table showing:
- Received time (IST timezone)
- Strategy name & ID
- Signal type (LONG/SHORT/EXIT with color badges)
- Symbol (trading pair)
- Segment (Indian/Forex/Crypto)
- Price (if provided)
- Signal ID (for deduplication tracking)

### **3. Open Positions**
Currently active positions with:
- User name & ID
- Strategy name & ID
- Symbol
- Side (LONG/SHORT)
- Quantity
- Entry price
- SL/TP levels (if set)
- Exit mode (SLTP or SIGNAL_ONLY)
- Opened timestamp

### **4. Recent Executions (Last 100)**
Per-user execution decisions:
- Timestamp
- User name & ID
- Strategy name & ID
- Decision badge:
  - **ENTER** (blue) — New position opened
  - **EXIT** (yellow) — Position closed
  - **REVERSE** (purple) — Position reversed
  - **SKIP** (gray) — No action taken
- Reason (e.g., NEW_ENTRY, ALREADY_IN_TARGET_SIDE, etc.)

---

## 🔄 **Auto-Refresh**

Dashboard automatically refreshes every **10 seconds** without manual intervention.

**Last updated timestamp** is shown in the header with IST timezone.

**Manual refresh button** is available (bottom-right floating button).

---

## 🎨 **Color Coding**

### Signal Badges:
- 🟢 **LONG** (green) — Buy/long signal
- 🔴 **SHORT** (red) — Sell/short signal  
- ⚪ **EXIT** (gray) — Close all signal

### Decision Badges:
- 🔵 **ENTER** (blue) — Entry execution
- 🟡 **EXIT** (yellow) — Exit execution
- 🟣 **REVERSE** (purple) — Reversal trade
- ⚫ **SKIP** (gray) — Skipped execution

### Position Badges:
- 🟢 **LONG** (green)
- 🔴 **SHORT** (red)

---

## 📱 **Mobile Responsive**

Dashboard is fully responsive and works on:
- Desktop browsers
- Tablets
- Mobile phones

---

## 🔍 **What Dashboard Shows**

✅ **Internal AlgoEngine Activity Only:**
- Webhook signals received from TradingView
- Per-user execution decisions
- Position state changes
- Real-time statistics

❌ **Does NOT Show:**
- Broker order book (removed)
- External broker data
- User account details
- Trade P&L calculations

---

## 🧪 **Test Dashboard**

### Send Test Signal:
```bash
curl -X POST http://31.97.60.221:3002/webhook/tradingview \
  -H "Content-Type: application/json" \
  -d '{"strategyId":10,"signal":1,"symbol":"TESTBTC","price":99000,"secret":"Uptrender@Algo2025"}'
```

### View Result:
```
http://31.97.60.221:3002/logs
```

Signal will appear in "Recent Webhook Signals" table immediately after 10s refresh.

---

## 🌐 **Domain Configuration (Optional)**

To access via `api.uptrender.com`:

1. Go to your DNS provider (Cloudflare/GoDaddy/etc.)
2. Add A record:
   - **Type:** A
   - **Name:** api
   - **Value:** 31.97.60.221
   - **TTL:** Auto

3. Wait 5-10 minutes for DNS propagation

4. Access:
   ```
   http://api.uptrender.com/logs
   ```

---

## 📊 **Data Refresh Rates**

- **Dashboard HTML:** Every 10 seconds (auto-refresh)
- **Database queries:** Real-time (on each page load)
- **Statistics:** Computed live from database
- **Tables:** Last 50-100 records (configurable)

---

## 🔧 **Technical Details**

- **Server:** Node.js Express
- **Port:** 3002
- **Database:** MySQL (algo_trading_db)
- **Process Manager:** PM2
- **Auto-start:** Yes (survives reboots)
- **Logs:** `/var/www/Algoengine/logs/`

---

## 📝 **Sample Dashboard Data**

When signals are active, you'll see data like:

### Recent Signal Example:
```
Time: 18/12/2025, 1:30:38 am
Strategy: Scalping Master #10
Signal: LONG (green badge)
Symbol: BTCUSDT
Segment: Crypto
Price: ₹98,500
Signal ID: 10_1_1766001638515
```

### Execution Example:
```
Time: 18/12/2025, 1:30:38 am
User: harish #14
Strategy: Scalping Master #10
Decision: ENTER (blue badge)
Reason: NEW_ENTRY
```

### Position Example:
```
User: harish #14
Strategy: Scalping Master #10
Symbol: BTCUSDT
Side: LONG (green badge)
Qty: 1.00
Entry: ₹100
SL: -
TP: -
Exit Mode: SIGNAL_ONLY
Opened: 18/12/2025, 1:30:38 am
```

---

## 🚀 **Quick Access Summary**

| Purpose | URL |
|---------|-----|
| **Dashboard** | http://31.97.60.221:3002/logs |
| **Health Check** | http://31.97.60.221:3002/health |
| **Webhook** | http://31.97.60.221:3002/webhook/tradingview |
| **Admin Panel** | http://31.97.60.221:3002/admin |

---

## 📞 **Support**

- **GitHub:** https://github.com/Haryshtiwari/algoengine
- **Server Logs:** `pm2 logs algoengine`
- **Database:** MySQL `algo_trading_db`
- **Config:** `/var/www/Algoengine/.env`

---

**🎊 Dashboard is fully operational and showing real-time AlgoEngine activity!**

**Last Updated:** December 17, 2025  
**Version:** 1.0.0
