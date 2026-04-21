# IBKR Connection + WebSocket Broadcaster Fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the double-clientId IBKR crash, wire the API WebSocket broadcaster so the dashboard gets live data, and unblock LightGBM on macOS.

**Architecture:** The bot connects once in `main.py` and passes the `ib` object everywhere. The strategy engine must NOT call `connect()` itself. The API runs a background polling task (every 3s) that reads latest state from PostgreSQL and broadcasts to all connected WebSocket clients — this is the bridge between the bot (which writes to DB) and the dashboard (which reads via WS).

**Tech Stack:** Python 3.11 async/await, ib_insync 0.9.86, FastAPI, asyncpg, Next.js WebSocket client

---

## Files Modified

| File | Change |
|------|--------|
| `bot/ibkr/connection.py` | Remove `util.startLoop()`, disconnect before reconnect, `ensure_connected(ib)` accepts+returns ib |
| `bot/strategy/engine.py` | `run_strategy_loop(ib)` accepts ib param, no longer calls `connect()` |
| `bot/main.py` | Pass `ib` to `run_strategy_loop(ib)` |
| `api/main.py` | Add background broadcaster task in lifespan |
| `api/websocket/broadcaster.py` | New file — DB polling + broadcast logic |

---

## Task 1: Commit Already-Fixed IBKR Connection Bugs

The double-connect bug is already fixed in the working tree. Commit it.

**Files:**
- Modify: `bot/ibkr/connection.py` (already edited)
- Modify: `bot/strategy/engine.py` (already edited)
- Modify: `bot/main.py` (already edited)

- [ ] **Step 1: Verify the diff is correct**

```bash
cd "/Users/nathanmihindu/Documents/Claude Workflow/New Trading Bot Futures"
git diff bot/ibkr/connection.py bot/strategy/engine.py bot/main.py
```

Expected: `connection.py` has no `util.startLoop()`, `ensure_connected` accepts `ib` param.
`engine.py` line ~25 has `async def run_strategy_loop(ib: IB):` with no `connect()` call inside.
`main.py` has `await run_strategy_loop(ib)`.

- [ ] **Step 2: Commit**

```bash
cd "/Users/nathanmihindu/Documents/Claude Workflow/New Trading Bot Futures"
git add bot/ibkr/connection.py bot/strategy/engine.py bot/main.py
git commit -m "fix(bot): pass ib to strategy loop — fix clientId 326 double-connect error

Root cause: run_strategy_loop() was calling connect() independently of main(),
creating a second IB() instance with the same clientId=1 while the first was
still alive. IBKR rejects duplicate clientIds with Error 326.

Fix: run_strategy_loop(ib) now accepts the ib object from main(). connect()
disconnects any existing IB before creating a new one. ensure_connected(ib)
accepts and returns ib so callers always use the current instance.
Remove util.startLoop() — not needed in asyncio.run() context.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Fix libomp for LightGBM (user action required)

LightGBM requires OpenMP on macOS. The bot cannot import LightGBM without it.

- [ ] **Step 1: Install libomp**

Run this in your terminal (NOT inside the venv — this is a system package):

```bash
brew install libomp
```

Expected output ends with: `libomp X.X.X is already installed` or `🍺 /opt/homebrew/Cellar/libomp/...`

- [ ] **Step 2: Verify LightGBM loads**

```bash
cd "/Users/nathanmihindu/Documents/Claude Workflow/New Trading Bot Futures/bot"
source venv/bin/activate
python -c "import lightgbm; print('LightGBM OK:', lightgbm.__version__)"
```

Expected: `LightGBM OK: 4.5.0` (no OSError about libomp)

---

## Task 3: API WebSocket Broadcaster Background Task

**Problem:** `broadcast()` in `api/websocket/manager.py` is never called. The bot writes to PostgreSQL, but nothing pushes that data to WS clients. The dashboard WebSocket is always silent.

**Solution:** Add a background coroutine in the API lifespan that polls the DB every 3 seconds and broadcasts the latest state to all connected clients.

**Files:**
- Create: `api/websocket/broadcaster.py`
- Modify: `api/main.py` (add broadcaster to lifespan)

- [ ] **Step 1: Create `api/websocket/broadcaster.py`**

```python
"""Background task that polls the database and broadcasts live state to WS clients."""
import asyncio
import logging
import os
from datetime import datetime, timezone, timedelta

import asyncpg

from websocket.manager import broadcast

log = logging.getLogger(__name__)

_last_signal_id = 0  # track last broadcast signal to avoid replays


async def _get_pool():
    return await asyncpg.create_pool(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", 5432)),
        database=os.getenv("POSTGRES_DB", "tradingbot"),
        user=os.getenv("POSTGRES_USER", "tradingbot"),
        password=os.getenv("POSTGRES_PASSWORD", ""),
        min_size=1,
        max_size=3,
    )


async def run_broadcaster():
    """Polls DB every 3 seconds and broadcasts live state to all WS clients."""
    global _last_signal_id

    pool = None
    while pool is None:
        try:
            pool = await _get_pool()
        except Exception as e:
            log.warning(f"Broadcaster waiting for DB: {e}")
            await asyncio.sleep(5)

    log.info("WebSocket broadcaster started")

    while True:
        try:
            async with pool.acquire() as conn:
                # 1. Latest account snapshot → account_update
                snap = await conn.fetchrow(
                    "SELECT net_liq, cash_balance, buying_power, unrealized_pnl, "
                    "realized_pnl_today FROM account_snapshots ORDER BY created_at DESC LIMIT 1"
                )
                if snap:
                    await broadcast("account_update", {
                        "net_liq":        float(snap["net_liq"] or 0),
                        "cash_balance":   float(snap["cash_balance"] or 0),
                        "buying_power":   float(snap["buying_power"] or 0),
                        "unrealized_pnl": float(snap["unrealized_pnl"] or 0),
                        "daily_pnl":      float(snap["realized_pnl_today"] or 0),
                    })

                # 2. Open positions → position_update
                # Positions are inferred from trades without a matching exit
                positions = await conn.fetch(
                    """
                    SELECT instrument, side, quantity, entry_price,
                           ml_confidence, regime_state
                    FROM trades
                    WHERE exit_ts IS NULL
                    ORDER BY entry_ts DESC
                    """
                )
                await broadcast("position_update", [
                    {
                        "instrument":    r["instrument"],
                        "side":          r["side"],
                        "quantity":      r["quantity"],
                        "entry_price":   float(r["entry_price"] or 0),
                        "ml_confidence": float(r["ml_confidence"] or 0),
                        "regime_state":  r["regime_state"],
                    }
                    for r in positions
                ])

                # 3. New signals since last broadcast → signal_fired (one per new row)
                new_signals = await conn.fetch(
                    "SELECT id, instrument, direction, confluence_score, "
                    "ml_confidence, fired, skip_reason, regime_state, created_at "
                    "FROM signals WHERE id > $1 ORDER BY id ASC LIMIT 20",
                    _last_signal_id,
                )
                for sig in new_signals:
                    await broadcast("signal_fired", {
                        "instrument":      sig["instrument"],
                        "direction":       sig["direction"],
                        "score":           sig["confluence_score"],
                        "ml_confidence":   float(sig["ml_confidence"] or 0),
                        "fired":           sig["fired"],
                        "skip_reason":     sig["skip_reason"],
                        "regime":          sig["regime_state"],
                        "ts":              sig["created_at"].isoformat(),
                    })
                    _last_signal_id = sig["id"]

                # 4. Recent trade fills → trade_fill (trades in last 10s with exit_ts set)
                recent_cutoff = datetime.now(timezone.utc) - timedelta(seconds=10)
                fills = await conn.fetch(
                    "SELECT instrument, side, quantity, exit_price, pnl "
                    "FROM trades WHERE exit_ts > $1 ORDER BY exit_ts DESC",
                    recent_cutoff,
                )
                for fill in fills:
                    await broadcast("trade_fill", {
                        "instrument":  fill["instrument"],
                        "side":        fill["side"],
                        "quantity":    fill["quantity"],
                        "fill_price":  float(fill["exit_price"] or 0),
                        "pnl":         float(fill["pnl"] or 0),
                    })

        except Exception as e:
            log.error(f"Broadcaster error: {e}", exc_info=True)

        await asyncio.sleep(3)
```

- [ ] **Step 2: Wire broadcaster into `api/main.py` lifespan**

Open `api/main.py`. The current lifespan is:

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    await _run_migrations()
    yield
```

Replace it with:

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    await _run_migrations()
    broadcaster_task = asyncio.create_task(run_broadcaster())
    yield
    broadcaster_task.cancel()
    try:
        await broadcaster_task
    except asyncio.CancelledError:
        pass
```

Also add these imports at the top of `api/main.py` (after the existing imports):

```python
import asyncio
from websocket.broadcaster import run_broadcaster
```

- [ ] **Step 3: Verify broadcaster file exists and main.py imports it**

```bash
cd "/Users/nathanmihindu/Documents/Claude Workflow/New Trading Bot Futures/api"
python -c "from websocket.broadcaster import run_broadcaster; print('OK')"
```

Expected: `OK` (no import errors)

- [ ] **Step 4: Commit**

```bash
cd "/Users/nathanmihindu/Documents/Claude Workflow/New Trading Bot Futures"
git add api/websocket/broadcaster.py api/main.py
git commit -m "feat(api): WebSocket background broadcaster — push live data to dashboard

Add run_broadcaster() background task that polls PostgreSQL every 3 seconds
and broadcasts to all connected WebSocket clients:
  - account_update: latest net_liq, buying_power, daily_pnl
  - position_update: all open positions (trades without exit_ts)
  - signal_fired: new signals since last broadcast (incremental by id)
  - trade_fill: fills in the last 10 seconds

This bridges the bot→DB→API→dashboard data pipeline, making the
dashboard WebSocket actually deliver live data instead of polling REST.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: End-to-End Verification

- [ ] **Step 1: Start PostgreSQL**

```bash
docker compose up postgres -d
# wait ~5s, then verify
docker compose ps
# Should show postgres as healthy
```

- [ ] **Step 2: Start the API**

```bash
cd "/Users/nathanmihindu/Documents/Claude Workflow/New Trading Bot Futures/api"
source venv/bin/activate
uvicorn main:app --port 8000
```

Expected log lines:
```
✓ Migrations applied (N statements) — database ready.
INFO:     Application startup complete.
INFO websocket.broadcaster: WebSocket broadcaster started
```

- [ ] **Step 3: Start the dashboard**

```bash
cd "/Users/nathanmihindu/Documents/Claude Workflow/New Trading Bot Futures/dashboard"
npm run dev
```

Open `http://localhost:3000`, log in with admin/admin. Open browser DevTools → Network → WS tab. You should see an active WebSocket connection to `ws://localhost:8000/ws`.

- [ ] **Step 4: Start the bot**

```bash
cd "/Users/nathanmihindu/Documents/Claude Workflow/New Trading Bot Futures/bot"
source venv/bin/activate
python main.py
```

Expected log (no Error 326, only one connection):
```
INFO ibkr.connection: Connected to IBKR TWS at 127.0.0.1:7497
INFO __main__: Training initial ML models for: ['ES', 'NQ', 'GC']
INFO ml.scheduler: ML retraining scheduler started (weekly, Sunday 23:00)
INFO strategy.engine: Strategy engine started
INFO strategy.engine: Regime detector fitted for ES
INFO strategy.engine: Regime detector fitted for NQ
INFO strategy.engine: Regime detector fitted for GC
```

- [ ] **Step 5: Confirm WS events in DevTools**

In the browser DevTools WS frame, within ~5 seconds of the bot connecting you should see frames like:

```json
{"event":"account_update","data":{"net_liq":...,"daily_pnl":...}}
{"event":"position_update","data":[]}
```

If you see these frames, the full pipeline is working.

---

## Notes

- **clientId conflict:** If you see Error 326 again after this fix, it means TWS itself has a stale connection from a previous crash. In TWS go to Edit → Global Configuration → API → Active API Connections and disconnect the stale one, then restart the bot.
- **libomp:** Must be installed system-wide via brew, not inside the venv.
- **Broadcaster vs REST polling:** The dashboard REST poll still runs as a fallback (only fires when WS is disconnected). Both systems coexist safely.
