# Uptrender Algo Engine — Clear Summary (Webhook + Multi-User + Multi-Broker)

## Goal
TradingView webhook se aane wale signals ko use karke, **DB/Dashboard config** ke basis par **multiple users** ke liye trades execute karna.

- **1 user = 1 broker**
- **1 user** ek hi broker par **multiple strategies** subscribe kar sakta hai
- **Quantity always fixed**: dashboard/DB me jo qty strategy ke liye saved hai, **wahi execute hogi**
- **No balance check**
- **Per-user SL/TP** support (same strategy me different users ke SL/TP ho sakte hain)
- **Segments**: `INDIAN`, `FOREX`, `CRYPTO`
- **Brokers to support** (adapter model): `MT5`, `Deriv`, `Binance`, `DeltaExchange`, `Angel One`, `AliceBlue`, `Zebu` (future extendable)

---

## TradingView Signal Contract
Webhook payload me `signal` (integer) aayega:

- `1`  → target position = **LONG**
- `-1` → target position = **SHORT**
- `0`  → target position = **FLAT (force exit)**

### Fixed Rules (confirmed)
1. **Signal = 0** aate hi **force exit** for everyone (SL/TP users included).
2. **Reversal**: `1` ↔ `-1` aaye to **square-off + reverse entry** (vice versa).
3. Symbols/segment normalization engine-side standard rakhna hai.

---

## Segment Model
Engine me 3 segment categories:

- **INDIAN**: Indian equities/index/F&O
- **FOREX**: MT5 instruments (EURUSD etc.)
- **CRYPTO**: Binance/Delta/Deriv instruments (BTC/USDT etc.)

Best practice:
- Webhook me `strategyId` aayega → engine DB se us strategy ka segment resolve karega (source of truth).
- Subscription filter: sirf same segment ke active subscribers.

---

## Canonical Symbol Standard (proposed)
Ek **canonical symbol** format define karo, phir broker adapters usko broker-specific symbol/token me map karein.

### CRYPTO
- Examples: `BTC/USDT`, `ETH/USDT`

### FOREX
- Examples: `FX:EUR/USD`, `FX:GBP/JPY`
- Broker mapping should handle suffix variants: `EURUSD`, `EURUSDm`, etc.

### INDIAN
- Cash: `NSE:RELIANCE-EQ`
- Index: `NSE:NIFTY50-INDEX`
- (Optional later) F&O: canonical structured string (expiry/strike/CE-PE)

---

## High-Level Flow (End-to-End)

### 1) Webhook Ingestion
1. Receive webhook POST.
2. **Auth/validate** (secret/token + required fields).
3. **Dedupe / Idempotency**: `signalId` (or hash) store; already processed → ignore.
4. Load `strategyId` details (segment + canonical symbol).
5. Query active subscribers for the strategy (user + dashboard config + active broker).
6. For each user: run execution logic (with per-user lock).

### 2) Per-User Execution Logic (State Reconciliation)
Current state = DB `Position` (OPEN?) for `(userId, strategyId, symbol)`.

Target state = webhook `signal` mapping.

#### If `signal = 0` (target FLAT)
- If current LONG → **SELL to close**
- If current SHORT → **BUY to close**
- If FLAT → do nothing
- Close reason: `FORCE_EXIT_SIGNAL_0`

#### If `signal = 1` (target LONG)
- current FLAT → **BUY entry**
- current LONG → do nothing
- current SHORT → **square-off + reverse**
  1) BUY to close short (close qty = open position qty)
  2) BUY entry to open long (entry qty = dashboard qty)

#### If `signal = -1` (target SHORT)
- current FLAT → **SELL entry**
- current SHORT → do nothing
- current LONG → **square-off + reverse**
  1) SELL to close long
  2) SELL entry to open short

**Quantity rule:**
- Entry qty always = **dashboard qty**
- Close qty ideally = **current open position qty**

---

## SL/TP Logic (Per User)
- SL/TP config dashboard me per user-strategy stored.
- Entry ke time:
  - If SL/TP enabled → entryPrice se `slPrice`/`tpPrice` compute karke position me store.
- Exit triggers:
  - **Signal 0 always force exit** (even SL/TP users).
  - SL/TP hit → exit (independent of TradingView signals).

### SL/TP Monitoring Options
1. **Internal LTP monitor (polling)**: every X seconds LTP check, hit → market exit.
2. **Broker-side SL/TP orders**: OCO/Bracket if broker supports; broker updates se position close mark.

---

## Multi-Broker Design (Adapter/Plugin)
Engine me ek **Broker Adapter Interface** rakhna hai:

Common normalized capabilities:
- Place entry order (BUY/SELL)
- Place exit/close order (BUY/SELL)
- (Optional) Place/cancel SL/TP orders OR provide LTP
- Normalize instrument: canonical symbol → broker symbol/token

Routing:
- Every user has `brokerType` + credentials
- Engine picks adapter by `brokerType`
- Segment/broker mismatch → skip & log error

---

## Concurrency / Safety
Must-have rule:
- Same `(userId, strategyId)` simultaneously process na ho (webhook + monitor).
- Use per-key lock: read position → decide → place order → update DB → unlock.

---

## Logging & Auditing (Mandatory)
Store 4 types of records:

1. **SignalLog**
   - strategyId, signal, canonicalSymbol, raw payload, timestamps, signalId

2. **ExecutionLog (per user per signal)**
   - userId, strategyId, decision (ENTER/EXIT/REVERSE/SKIP), reason, timestamps

3. **OrderLog**
   - broker request/response, brokerOrderId, status transitions

4. **Position**
   - OPEN/CLOSED, side, qty, entry/exit price/time, slPrice/tpPrice, exitReason (`SIGNAL_0`, `REVERSAL`, `SL`, `TP`)

---

## Key Outcomes
- Same strategy signal → multiple users trade execute
- Per-user qty fixed from DB
- Per-user SL/TP independent exits
- Signal `0` universally force-flat
- Reversals do square-off + reverse
- Segments + broker adapters keep system scalable