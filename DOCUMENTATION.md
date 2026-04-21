# Futures Trading Bot — Complete Technical Documentation

> **Purpose:** Full reference for understanding, running, and presenting this system. Covers architecture, every subsystem, startup on macOS, all configuration, and how each component works.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Directory Structure](#3-directory-structure)
4. [Startup Guide — macOS](#4-startup-guide--macos)
5. [Configuration Reference](#5-configuration-reference)
6. [Trading Strategy — Deep Dive](#6-trading-strategy--deep-dive)
7. [Machine Learning Pipeline](#7-machine-learning-pipeline)
8. [Backtesting System](#8-backtesting-system)
9. [Database Schema](#9-database-schema)
10. [REST API Reference](#10-rest-api-reference)
11. [WebSocket API](#11-websocket-api)
12. [Dashboard Pages](#12-dashboard-pages)
13. [Risk Management](#13-risk-management)
14. [IBKR Integration](#14-ibkr-integration)
15. [Docker Deployment](#15-docker-deployment)
16. [Security Model](#16-security-model)
17. [Design Decisions & Trade-offs](#17-design-decisions--trade-offs)

---

## 1. Project Overview

This is an **automated algorithmic trading system** built for US equity index and gold futures markets. It connects to Interactive Brokers (IBKR), analyses market conditions across three timeframes, and places bracket orders (entry + stop-loss + take-profit) when a sufficient number of independent signals align.

### What it trades

| Instrument | Full Name | Exchange | Point Value |
|------------|-----------|----------|-------------|
| ES | E-mini S&P 500 | CME | $50 per point |
| NQ | E-mini Nasdaq-100 | CME | $20 per point |
| GC | Gold | COMEX | $100 per point |

### Key capabilities

- **Multi-timeframe confluence scoring** — 6 independent signals across 15m, 1h, and 4h bars
- **Hidden Markov Model regime detection** — only trades in statistically "trending" market conditions
- **LightGBM ML filter** — trained on historical trade outcomes; blocks signals below 65% win probability
- **Kelly Criterion position sizing** — sizes positions based on historical win rate and payoff ratio
- **Pairs monitoring** — avoids entering ES when NQ is statistically more attractive (and vice versa)
- **Daily drawdown kill switch** — halts all trading if account drops 3% from daily peak
- **Walk-forward backtesting** — simulate the exact same strategy on 2 years of yfinance data
- **Real-time dashboard** — Next.js UI with live P&L, charts, analytics, and backtest results

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         macOS Machine                           │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │  IBKR TWS /  │    │   Bot        │    │   Dashboard      │  │
│  │  Gateway     │◄───│   (Python)   │    │   (Next.js)      │  │
│  │  Port 7497   │    │              │    │   Port 3000      │  │
│  └──────────────┘    │  Strategy    │    │                  │  │
│                       │  Engine      │    │  /overview       │  │
│                       │  ML Filter   │    │  /trading        │  │
│                       │  Backtester  │    │  /backtest       │  │
│                       └──────┬───────┘    │  /analytics      │  │
│                              │            │  /ml             │  │
│  ┌───────────────────────────▼──────────┐ │  /controls       │  │
│  │  PostgreSQL 15 (Docker)  Port 5432   │ └──────┬───────────┘  │
│  │                                      │        │              │
│  │  trades  signals  snapshots          │        │ HTTP + WS    │
│  │  backtest_runs  backtest_trades      │ ┌──────▼───────────┐  │
│  │  backtest_equity_curve               │ │  FastAPI         │  │
│  └──────────────────────────────────────┘ │  Port 8000       │  │
│                                            │                  │  │
│                                            │  JWT Auth        │  │
│                                            │  REST Routes     │  │
│                                            │  WebSocket       │  │
│                                            └──────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Data flow for a live trade

```
IBKR → get_bars() → score_confluence() → RegimeDetector.predict()
     → ml_approved() → RiskManager.compute_order() → place_bracket_order()
     → write_signal() → PostgreSQL → FastAPI → Dashboard WebSocket
```

### Data flow for a backtest

```
yfinance → fetch_1h_bars() → resample_to_4h()
         → RegimeDetector.fit(warmup) → walk-forward loop
         → score_confluence() per bar → pnl_list
         → compute_metrics() → PostgreSQL (backtest_runs + trades + equity_curve)
         → FastAPI → Dashboard (equity curve chart + trade table)
```

---

## 3. Directory Structure

```
New Trading Bot Futures/
├── .env                        # All environment variables (never commit)
├── docker-compose.yml          # Orchestrates postgres + api + bot + dashboard
│
├── bot/                        # Trading bot (Python 3.11)
│   ├── main.py                 # Entrypoint: starts strategy loop + ML scheduler
│   ├── config.py               # All constants loaded from .env
│   ├── requirements.txt
│   │
│   ├── strategy/               # Core trading logic
│   │   ├── engine.py           # Main loop: evaluate each instrument each minute
│   │   ├── confluence.py       # score_confluence() — 6-signal scorer
│   │   ├── indicators.py       # EMA, MACD, RSI, ATR (pandas-based)
│   │   ├── vwap.py             # VWAP + standard deviation bands
│   │   ├── order_flow.py       # Synthetic cumulative delta from OHLCV
│   │   ├── regime_hmm.py       # 3-state Gaussian HMM regime classifier
│   │   ├── ml_filter.py        # LightGBM inference + model loader
│   │   ├── kelly.py            # Kelly Criterion position sizing formula
│   │   ├── risk_manager.py     # Daily kill switch + order sizing
│   │   ├── zscore.py           # Z-score of price vs VWAP
│   │   ├── volume_profile.py   # Point of Control (POC) computation
│   │   └── pairs_monitor.py    # ES/NQ statistical arbitrage signal
│   │
│   ├── backtest/               # Walk-forward backtesting (no IBKR needed)
│   │   ├── engine.py           # Subprocess CLI entry point
│   │   ├── data_loader.py      # yfinance download + 4h resampling
│   │   └── metrics.py          # Sharpe, Sortino, drawdown, etc.
│   │
│   ├── ibkr/                   # Interactive Brokers connectivity
│   │   ├── connection.py       # ib_insync IB() connect/reconnect
│   │   ├── market_data.py      # get_bars() historical data fetch
│   │   ├── account_monitor.py  # Net liquidation value, cash
│   │   └── order_manager.py    # place_bracket_order()
│   │
│   ├── ml/                     # ML training pipeline
│   │   ├── feature_engineering.py   # build_features(): 11 technical features
│   │   ├── trainer.py          # LightGBM train + cross-validate + save
│   │   └── scheduler.py        # Weekly retraining scheduler (daemon thread)
│   │
│   └── db/
│       └── writer.py           # Async PostgreSQL writes (signals, snapshots)
│
├── api/                        # FastAPI REST + WebSocket server (Python 3.11)
│   ├── main.py                 # App init + CORS + router registration
│   ├── requirements.txt
│   │
│   ├── auth/
│   │   └── routes.py           # POST /auth/login → JWT
│   │
│   ├── routes/
│   │   ├── account.py          # GET /account
│   │   ├── positions.py        # GET /positions
│   │   ├── trades.py           # GET /trades
│   │   ├── signals.py          # GET /signals
│   │   ├── performance.py      # GET /performance
│   │   ├── bot.py              # GET+POST /bot, POST /bot/kill
│   │   ├── snapshots.py        # GET /snapshots
│   │   ├── ml.py               # GET /ml/metrics
│   │   └── backtest.py         # POST /backtest/run + GET endpoints
│   │
│   ├── db/
│   │   └── connection.py       # SQLAlchemy async engine + get_db()
│   │
│   └── websocket/
│       └── manager.py          # WS /ws + broadcast loop
│
├── dashboard/                  # Next.js 16 frontend (React 19)
│   ├── app/                    # App Router pages
│   │   ├── layout.tsx          # Root layout with Sidebar + Header
│   │   ├── page.tsx            # /overview
│   │   ├── trading/page.tsx    # /trading — candlestick charts
│   │   ├── backtest/page.tsx   # /backtest — run + results
│   │   ├── performance/page.tsx
│   │   ├── analytics/page.tsx
│   │   ├── ml/page.tsx
│   │   ├── journal/page.tsx
│   │   ├── controls/page.tsx
│   │   └── login/page.tsx
│   │
│   ├── components/
│   │   ├── ShellLayout.tsx     # Auth wrapper: shows login or app shell
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   └── Header.tsx
│   │   ├── charts/
│   │   │   ├── InstrumentChart.tsx  # lightweight-charts v5 candlestick
│   │   │   └── EquityCurve.tsx      # Recharts area chart
│   │   └── panels/
│   │       ├── PositionsTable.tsx   # Open positions with sorting/filtering
│   │       └── TimeSales.tsx        # Simulated time & sales tape
│   │
│   └── lib/
│       ├── api.ts              # All API calls + TypeScript interfaces
│       └── websocket.ts        # WebSocket singleton with reconnect + typed events
│
└── db/
    └── migrations/
        ├── 001_initial.sql     # Core schema (trades, signals, snapshots, etc.)
        └── 002_backtest.sql    # Backtest tables
```

---

## 4. Startup Guide — macOS

### Prerequisites

Install these before anything else:

```bash
# Homebrew (if not already installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Docker Desktop — download from docker.com and open the app
# Node.js 20+
brew install node
# Python 3.11
brew install python@3.11
# uv (fast Python package manager — optional but recommended)
pip install uv
```

You also need **Interactive Brokers TWS or Gateway** installed and running if you want live trading. Download from ibkr.com. Enable API connections in TWS: Edit → Global Configuration → API → Settings → check "Enable ActiveX and Socket Clients", port 7497.

### Step 1 — Clone and set up environment

```bash
cd ~/Documents
# Assuming you already have the project folder
cd "Claude Workflow/New Trading Bot Futures"

# The .env file is already present with defaults — review and update as needed
cat .env
```

The critical values in `.env`:

```env
POSTGRES_HOST=postgres      # Use 'localhost' when running locally (not Docker)
POSTGRES_PORT=5432
POSTGRES_DB=tradingbot
POSTGRES_USER=tradingbot
POSTGRES_PASSWORD=changeme_secure_password

JWT_SECRET=5e984e321726b4bd...   # Change this in production
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=$2b$12$...   # bcrypt hash of your password
```

**For local development** (API and bot running directly, not in Docker), change `POSTGRES_HOST=postgres` to `POSTGRES_HOST=localhost` in `.env`.

### Step 2 — Start PostgreSQL (Docker)

```bash
# Start only the database (not the full stack)
docker compose up postgres -d

# Verify it's healthy
docker compose ps
# Should show postgres as "healthy"

# Apply the backtest migration (run once after first start)
docker exec -i newtradingbotfutures-postgres-1 \
  psql -U tradingbot -d tradingbot \
  < db/migrations/002_backtest.sql

# Verify tables exist
docker exec -it newtradingbotfutures-postgres-1 \
  psql -U tradingbot -d tradingbot -c "\dt"
```

### Step 3 — Start the FastAPI backend

Open a new terminal tab:

```bash
cd "~/Documents/Claude Workflow/New Trading Bot Futures/api"

# Install dependencies (first time only)
pip install -r requirements.txt

# Start the API (with auto-reload for development)
uvicorn main:app --reload --port 8000

# You should see:
# INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
# INFO:     Application startup complete.
```

Verify it's working:
```bash
curl http://localhost:8000/health
# {"status":"ok"}
```

### Step 4 — Start the Next.js dashboard

Open another terminal tab:

```bash
cd "~/Documents/Claude Workflow/New Trading Bot Futures/dashboard"

# Install dependencies (first time only)
npm install

# Start development server
npm run dev

# You should see:
# ▲ Next.js 15.x.x
# - Local: http://localhost:3000
```

Open your browser at **http://localhost:3000**. You'll see the login page.

**Default credentials:**
- Username: `admin`
- Password: `admin` (the hash in `.env` corresponds to this)

### Step 5 — Start the trading bot (optional, requires IBKR)

Open another terminal tab:

```bash
cd "~/Documents/Claude Workflow/New Trading Bot Futures/bot"

# Install dependencies (first time only)
pip install -r requirements.txt

# Make sure IBKR TWS or Gateway is running first
# Then start the bot
python main.py
```

### Step 6 — Run a backtest (no IBKR needed)

```bash
# From the bot directory, test the backtest engine directly
cd "~/Documents/Claude Workflow/New Trading Bot Futures/bot"

python -m backtest.engine \
  --run_id test-001 \
  --instrument ES \
  --start_date 2024-01-01 \
  --end_date 2025-01-01 \
  --initial_equity 100000
```

Or use the dashboard: navigate to `/backtest`, select ES, set dates, click **RUN BACKTEST**.

### Stopping everything

```bash
# Stop Next.js and FastAPI: Ctrl+C in their respective terminals

# Stop Docker
docker compose down

# Stop Docker AND delete all data (full reset)
docker compose down -v
```

---

## 5. Configuration Reference

All configuration lives in `bot/config.py`, which reads from `.env` via `python-dotenv`.

### IBKR Connection

| Variable | Default | Description |
|----------|---------|-------------|
| `IBKR_HOST` | `127.0.0.1` | TWS/Gateway host |
| `IBKR_PORT` | `7497` | TWS paper trading port (live: 7496) |
| `IBKR_CLIENT_ID` | `1` | Must be unique per connected client |

### Database

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_HOST` | `postgres` | Docker hostname; use `localhost` for local dev |
| `POSTGRES_PORT` | `5432` | Standard PostgreSQL port |
| `POSTGRES_DB` | `tradingbot` | Database name |
| `POSTGRES_USER` | `tradingbot` | Database user |
| `POSTGRES_PASSWORD` | `changeme_secure_password` | Change in production |

### Strategy Parameters (hardcoded in `config.py`)

| Parameter | Value | Description |
|-----------|-------|-------------|
| `INSTRUMENTS` | `["ES", "NQ", "GC"]` | Instruments to trade |
| `EMA_SHORT` | `20` | Fast EMA period |
| `EMA_LONG` | `50` | Slow EMA period |
| `EMA_TREND` | `200` | Long-term trend filter |
| `MACD_FAST` | `12` | MACD fast EMA |
| `MACD_SLOW` | `26` | MACD slow EMA |
| `MACD_SIGNAL` | `9` | MACD signal line |
| `RSI_PERIOD` | `14` | RSI lookback |
| `ATR_PERIOD` | `14` | ATR lookback |
| `CONFLUENCE_THRESHOLD` | `5` | Minimum signals required out of 6 |

### Risk Parameters

| Variable | Default | Description |
|----------|---------|-------------|
| `RISK_PCT` | `0.01` | Minimum risk per trade (1% of equity) |
| `ATR_STOP_MULT` | `1.5` | Stop loss = entry − (1.5 × ATR) |
| `ATR_TP_MULT` | `3.0` | Take profit = entry + (3.0 × ATR) |
| `DAILY_KILL_PCT` | `0.03` | Halt trading if equity drops 3% from daily peak |

This gives a **2:1 reward-to-risk ratio** on every trade (3.0 ATR target / 1.5 ATR stop).

### ML Parameters

| Variable | Default | Description |
|----------|---------|-------------|
| `ML_MIN_CONFIDENCE` | `0.65` | LightGBM must predict ≥65% win probability |
| `ML_RETRAIN_DAYS` | `7` | Retrain models every Sunday |
| `ML_LOOKBACK_YEARS` | `3` | Training data lookback |
| `MODEL_DIR` | `/app/ml_models` | Where `.pkl` model files are saved |

---

## 6. Trading Strategy — Deep Dive

### Overview

The strategy uses **multi-timeframe confluence scoring**: 6 independent boolean conditions are checked across three timeframes. Only signals where 5 or more conditions are true (out of 6) are considered valid. This reduces false positives dramatically.

```
Signal fires when:
  regime == "trending"   (hard gate — must be true)
  AND score >= 5         (at least 5/6 conditions true)
  AND ml_approved()      (LightGBM >= 65% confidence)
  AND pairs OK           (ES/NQ spread not skewed away)
```

### The 6 Confluence Conditions

**Condition 1 — 4H Trend Direction** (`score_confluence.py` line 37)
```python
r4["close"] > r4["ema50"] and r4["macd_hist"] > 0
```
The 4-hour close must be above the 50-period EMA AND the MACD histogram must be positive. This confirms the dominant trend direction is upward on the higher timeframe.

**Condition 2 — 1H Momentum** (line 42)
```python
r1["ema20"] > r1["ema50"] and 40 < r1["rsi"] < 70
```
On the 1-hour chart, the fast EMA must be above the slow EMA (golden cross condition) AND RSI must be in the healthy momentum zone (40–70). RSI above 70 indicates overbought conditions where we avoid entry.

**Condition 3 — 15m MACD Crossover** (line 47)
```python
r15["macd_hist"] > 0 and d15["macd_hist"].iloc[-2] <= 0
```
The MACD histogram on the 15-minute chart just crossed from negative to positive — this detects the precise moment when short-term momentum turns bullish. This is the timing signal.

**Condition 4 — Price Above VWAP** (line 52)
```python
r15["close"] > r15["vwap"]
```
The current price is above the Volume Weighted Average Price. Institutional traders treat VWAP as the "fair value" for the day. Trading above it indicates buyers are in control.

**Condition 5 — Positive Cumulative Delta** (line 56)
```python
r15["cumulative_delta"] > 0
```
Cumulative order flow delta (approximated from OHLCV — high-close vs close-low) is positive, meaning aggressive buyers have been dominant in recent bars.

**Condition 6 — Not Extended vs VWAP** (line 61)
```python
abs(r15.get("price_vs_vwap", 0)) < 2.0
```
Price is within 2 standard deviations of VWAP. Entries when price is already stretched (>2σ) have poor reward/risk profiles as mean reversion becomes likely.

### Regime Gate

Before any signal is processed, the `RegimeDetector` classifies the current market state. Trading only happens in the `"trending"` regime.

The regime detector uses a **3-state Gaussian Hidden Markov Model** (HMM) trained on 4-hour returns. The three features are:
1. Bar-to-bar percentage return
2. Rolling 20-bar return volatility
3. Rolling 10-bar mean return (momentum)

After fitting, the 3 hidden states are automatically labelled by their volatility signature:
- **Lowest volatility** → `"ranging"` (choppy sideways market)
- **Medium volatility** → `"trending"` (directional, consistent momentum)
- **Highest volatility** → `"volatile"` (news-driven, erratic)

This is a fundamentally different approach from traditional moving average trend filters because it learns the statistical fingerprint of each market condition rather than using arbitrary rules.

### Pairs Monitor

For ES and NQ specifically, the bot tracks the spread between the two instruments. Since they are highly correlated (both track US large-cap tech), when the spread becomes statistically extreme, the bot prefers whichever instrument is relatively undervalued.

```python
# If ES-NQ spread is at +2σ → ES is expensive, NQ is cheap → prefer NQ
# Signal: "long_nq_short_es" → skip ES entry, take NQ instead
```

This prevents the bot from entering both ES and NQ when they're giving the same signal, which would concentrate risk unnecessarily.

### Order Execution

When all gates pass, `place_bracket_order()` submits three orders simultaneously to IBKR:
1. **Entry order** — market or limit at current close price
2. **Stop-loss** — entry price − (1.5 × ATR)
3. **Take-profit** — entry price + (3.0 × ATR)

The bracket structure means the position is automatically closed by IBKR regardless of whether the bot is running — crucial for safety.

---

## 7. Machine Learning Pipeline

### Why ML?

Even when all 5+ technical signals align, roughly 40–45% of those setups historically fail. The ML filter attempts to identify which setups have the highest probability of success based on the feature state at entry time.

### Feature Engineering (`bot/ml/feature_engineering.py`)

11 features are computed from the 15-minute bar data at each potential signal point:

| Feature | Description |
|---------|-------------|
| `rsi` | RSI(14) — momentum oscillator |
| `macd_hist` | MACD histogram value |
| `ema20_slope` | Rate of change of EMA20 over last 5 bars |
| `vwap_dev` | Price deviation from VWAP (in ATR units) |
| `atr_pct` | ATR as percentage of price (volatility normalisation) |
| `volume_ratio` | Current bar volume / 20-bar average volume |
| `bar_range` | High-Low range as percentage of close |
| `close_vs_high` | Position of close within bar's range (0=low, 1=high) |
| `cum_delta_norm` | Cumulative delta normalised by ATR |
| `ema_spread` | (EMA20 - EMA50) / ATR (trend strength) |
| `bb_pct` | Bollinger Band percentile (0=lower band, 1=upper band) |

### Model: LightGBM Classifier

LightGBM was chosen because:
- Handles small-to-medium tabular datasets efficiently
- Robust to feature scaling (no normalisation required)
- Provides calibrated probability estimates via `predict_proba()`
- Fast inference (sub-millisecond per prediction)

The model is trained as a binary classifier:
- **Class 0** — trade loses (outcome ≤ 0)
- **Class 1** — trade wins (outcome > 0)

The threshold used is **0.65** — the model must predict >65% probability of a win for the signal to proceed.

### Training (`bot/ml/trainer.py`)

1. Fetches historical OHLCV data (3-year lookback via yfinance)
2. Simulates every signal that would have fired historically
3. Computes the actual outcome for each (did the take-profit or stop-loss hit first?)
4. Builds a labelled dataset of `(features, outcome)`
5. Trains LightGBM with 5-fold cross-validation
6. Saves the model to `MODEL_DIR/{instrument}_lgbm.pkl`

### Scheduling

The ML scheduler (`bot/ml/scheduler.py`) runs every Sunday at 23:00 in a background daemon thread using the `schedule` library. It uses `asyncio.run_coroutine_threadsafe()` to submit `retrain_all()` onto the main event loop, so all `ib_insync` calls remain on the correct loop. If training fails for one instrument, the exception is caught and logged — the scheduler continues and will retry the following Sunday. This ensures the model is retrained on the most recent 3 years of data weekly, adapting to changing market conditions.

### Graceful Fallback

If no model file exists (first run, or model directory is empty), `ml_filter.py` returns `confidence = 1.0` — meaning all signals pass the ML gate. This allows the bot to trade immediately before the first training run completes.

---

## 8. Backtesting System

### Design Philosophy

The backtester reuses the **exact same strategy code** as the live bot. There is no separate "backtest strategy" — `score_confluence()`, `RegimeDetector`, and all indicators are called identically. This eliminates the risk of the backtest and live strategy diverging.

### Walk-Forward Methodology

Rather than fitting indicators on the full dataset (which would introduce lookahead bias), the backtest uses a **walk-forward** approach:

```
Timeline:
  [warmup window: 200 bars] | [test window: start_date → end_date]
         ↑                                     ↑
   RegimeDetector.fit()              score_confluence() called
   on this data only                 on rolling 200-bar window
```

At each bar `i` in the test window:
1. The 200-bar slice ending at `i` is used for indicators (no future data)
2. The regime detector was trained only on pre-`start_date` data
3. The ML filter is **disabled** in backtest to avoid lookahead (the ML models would need to be trained only on pre-backtest data, which requires a much more complex pipeline)

### Data Source

Historical data comes from **yfinance** (Yahoo Finance), not IBKR. This is deliberate:
- yfinance provides up to **730 days** of 1-hour bars — much more than IBKR's typical API limits
- No IBKR connection required to run backtests
- Data is free and available 24/7

The yfinance ticker symbols used:
- ES → `/ES=F` (E-mini S&P 500 front-month futures)
- NQ → `/NQ=F` (E-mini Nasdaq-100 front-month futures)
- GC → `/GC=F` (Gold front-month futures)

### 15-Minute Proxy

`score_confluence()` expects three dataframes: `df_15m`, `df_1h`, and `df_4h`. However, yfinance only provides a maximum of ~60 days of 15-minute data — far too little for meaningful backtesting.

The backtest passes **1h bars as both `df_15m` and `df_1h`**. This means:
- Condition 3 (15m MACD crossover) fires on **1-hour MACD crossovers** instead
- You get 730 days of history instead of 60 days
- This is an explicitly accepted tradeoff, documented in the engine code

### Metrics Computed

| Metric | Formula | Interpretation |
|--------|---------|----------------|
| `total_return` | `(final_equity - initial_equity) / initial_equity` | Total percentage gain/loss |
| `sharpe` | `mean(returns) / std(returns) × √(252 × 6.5)` | Risk-adjusted return; >1.0 is good |
| `sortino` | `mean(returns) / std(downside_returns) × √(252 × 6.5)` | Like Sharpe but only penalises downside |
| `max_drawdown` | Peak-to-trough decline | Worst historical loss from peak; <15% is healthy |
| `calmar` | `total_return / max_drawdown` | Return relative to max drawdown |
| `profit_factor` | `sum(wins) / sum(losses)` | >1.5 is good; >2.0 is excellent |
| `win_rate` | `wins / total_trades` | % of trades that are profitable |
| `avg_win` | `mean(positive PnLs)` | Average dollar profit per winning trade |
| `avg_loss` | `mean(abs(negative PnLs))` | Average dollar loss per losing trade |
| `expectancy` | `(win_rate × avg_win) - ((1 - win_rate) × avg_loss)` | Expected value per trade |

Annualisation factor: `√(252 trading days × 6.5 trading hours per day)` — appropriate for 1-hour bars.

### Subprocess Architecture

Running a 1-year backtest takes 2–3 minutes (yfinance download + 5,000+ bar iterations). The FastAPI server cannot block for this duration — it would time out all other requests.

Solution: The API immediately returns `{run_id, status: "pending"}` and spawns the backtest engine as a **child process**:

```python
subprocess.Popen([
    sys.executable, "-m", "backtest.engine",
    "--run_id", run_id,
    "--instrument", instrument,
    "--start_date", start_date,
    "--end_date", end_date,
    "--initial_equity", str(initial_equity),
], cwd=BOT_DIR, env={**os.environ, "PYTHONPATH": BOT_DIR})
```

The dashboard frontend polls `GET /backtest/runs/{run_id}` every 3 seconds. When `status` changes from `"running"` to `"completed"`, it fetches the equity curve and trade list and renders them.

---

## 9. Database Schema

### Core Tables (from `001_initial.sql`)

**`trades`** — every executed trade
```sql
id, instrument, side (LONG/SHORT), quantity,
entry_ts, exit_ts, entry_price, exit_price,
pnl, pnl_pct, commission,
ml_confidence, regime_state, delta_at_entry,
vwap_at_entry, atr_at_entry, kelly_fraction,
confluence_score, exit_reason, created_at
```

**`signals`** — every time the strategy evaluated an instrument (including skipped signals)
```sql
id, instrument, score, direction, regime,
ema_signal, macd_signal, rsi_signal, vwap_signal, delta_signal,
atr, close_price, vwap_price, delta,
fired (boolean — did it place an order?),
skip_reason, created_at
```

**`account_snapshots`** — periodic equity snapshots every iteration
```sql
id, net_liq, cash_balance, unrealized_pnl,
daily_pnl, buying_power, created_at
```

### Backtest Tables (from `002_backtest.sql`)

**`backtest_runs`** — one row per simulation run
```sql
id (serial), run_id (uuid), instrument, start_date, end_date,
initial_equity, final_equity, total_return, sharpe, sortino,
max_drawdown, calmar, profit_factor, total_trades,
wins, losses, win_rate, avg_win, avg_loss, expectancy,
parameters (jsonb), status (pending/running/completed/failed),
created_at
```

**`backtest_trades`** — individual trades within a simulation
```sql
id, backtest_run_id → backtest_runs(id),
instrument, side, quantity, entry_ts, exit_ts,
entry_price, exit_price, pnl, pnl_pct,
confluence_score, ml_confidence (null in backtest),
regime_state, exit_reason
```

**`backtest_equity_curve`** — equity at each bar (downsampled to max 2,000 points)
```sql
id, backtest_run_id → backtest_runs(id),
ts (timestamptz), equity (numeric)
```

### Indexes

```sql
-- Fast lookup of live trades
idx_trades_instrument, idx_trades_entry_ts, idx_trades_instrument_ts

-- Backtest queries
idx_backtest_runs_run_id (unique), idx_backtest_trades_run, idx_backtest_equity_run
```

---

## 10. REST API Reference

Base URL: `http://localhost:8000`

All endpoints except `/auth/login` and `/health` require a JWT bearer token:
```
Authorization: Bearer <token>
```

### Authentication

**`POST /auth/login`**
```json
Request:  {"username": "admin", "password": "admin"}
Response: {"access_token": "eyJ...", "token_type": "bearer"}
```
Token expires after 24 hours (configurable via `JWT_SECRET` in `.env`).

### Account & Positions

**`GET /account`** — Current account state (net liquidation, cash, P&L)

**`GET /positions`** — All open positions

**`GET /trades`** — Trade history. Query params: `?instrument=ES`, `?limit=100`, `?start=2024-01-01`

**`GET /signals`** — Recent signal evaluations (fired and skipped)

**`GET /performance`** — Aggregate performance metrics (win rate, Sharpe, total return)

**`GET /snapshots?hours=24`** — Account equity snapshots for the last N hours

### Bot Control

**`GET /bot`** — Current bot state (running, paused, kill switch active)

**`POST /bot`** — Update bot parameters
```json
{"trading_enabled": true, "risk_pct": 0.01, "confluence_threshold": 5}
```

**`POST /bot/kill`** — Emergency kill switch — immediately halts all trading

### ML

**`GET /ml/metrics`** — Last training run metrics per instrument (accuracy, precision, recall, F1)

### Backtesting

**`POST /backtest/run`** — Start a new backtest (non-blocking)
```json
Request:  {"instrument": "ES", "start_date": "2024-01-01", "end_date": "2025-01-01", "initial_equity": 100000}
Response: {"run_id": "uuid-...", "status": "pending"}
```

**`GET /backtest/runs`** — List all runs (summary only). Query: `?instrument=ES`

**`GET /backtest/runs/{run_id}`** — Full run result including equity curve array

**`GET /backtest/runs/{run_id}/trades`** — All individual trades for a run

### Health

**`GET /health`** — Returns `{"status": "ok"}` — used for Docker health checks

---

## 11. WebSocket API

**Endpoint:** `ws://localhost:8000/ws?token=<jwt>`

After HTTP upgrade, the server broadcasts JSON messages in the following envelope format:

```json
{"event": "<event_name>", "data": {...}}
```

**Event names and payloads:**

| Event | When fired | Payload |
|-------|-----------|---------|
| `position_update` | After any position change | Array of current open positions |
| `account_update` | After each account snapshot | `{net_liq, daily_pnl, unrealized_pnl, buying_power}` |
| `signal_fired` | When strategy evaluates an instrument | `{instrument, score, direction, regime, fired, skip_reason, ml_confidence}` |
| `trade_fill` | When an IBKR order is filled | `{instrument, side, quantity, fill_price, pnl}` |

**Example messages:**
```json
{"event": "signal_fired", "data": {"instrument": "ES", "score": 5, "direction": "long", "regime": "trending", "fired": true, "ml_confidence": 0.71}}
{"event": "trade_fill",   "data": {"instrument": "ES", "side": "BUY", "quantity": 2, "fill_price": 5841.50, "pnl": null}}
{"event": "account_update","data": {"net_liq": 105420.50, "daily_pnl": 1250.00, "unrealized_pnl": 320.00, "buying_power": 85000.00}}
```

The dashboard `wsClient` singleton (`dashboard/lib/websocket.ts`) connects automatically when the Overview or Trading page loads and reconnects every 3 seconds on disconnect. The Overview page subscribes to `position_update`, `account_update`, and `signal_fired`. The Trading page subscribes to `trade_fill` to display live fill badges on chart headers.

---

## 12. Dashboard Pages

All pages share the same layout: a fixed left sidebar (200px) and a top header, with the content area filling the remaining space.

### Design System

The dashboard uses an "obsidian terminal" aesthetic:

| Token | Value | Usage |
|-------|-------|-------|
| Surface | `#080B12` | Page backgrounds, cards |
| Raised | `#0D1018` | Elevated panels |
| Border | `#1A2035` | Dividers, card borders |
| Champagne Gold | `#C9A84C` | Active states, accents, key numbers |
| Emerald | `#00E5A0` | Positive P&L, bullish signals |
| Crimson | `#FF3A5C` | Negative P&L, bearish signals, alerts |
| Platinum | `#F0F4FF` | Primary text |
| Muted | `#8892B0` | Secondary text, labels |
| Dim | `#3D4760` | Disabled, inactive |
| Font | JetBrains Mono | All numbers and data |

### `/overview`
Live dashboard summary: account equity gauge, daily P&L, recent signals, active positions table, equity curve sparkline.

### `/trading`
Candlestick charts for all three instruments with VWAP, VWAP bands, EMA20/50 overlays. Time & Sales panels showing recent prints. Built on **lightweight-charts v5.1.0** — note this version uses `chart.addSeries(CandlestickSeries, {...})` instead of the v4 `chart.addCandlestickSeries({...})`.

### `/backtest`
Full backtesting interface. The **left panel** has a form: instrument selector (ES/NQ/GC), start and end date pickers, initial equity input, and a **RUN BACKTEST** button that calls `POST /backtest/run`. The **right panel** lists all historical runs with status badges (pending / running / completed / failed). Polls `GET /backtest/runs/{id}` every 3 seconds while a run is in progress.

When a run completes, the **results section** renders below: 8 metric cards (total return, Sharpe, Sortino, max drawdown, Calmar, profit factor, win rate, expectancy), an equity curve `AreaChart`, and a trade table showing every backtest trade with entry time, exit time, side, P&L, confluence score, and exit reason.

### `/performance`
Historical performance analytics for live trading. Displays an equity curve (24h window), 4 summary stat cards (Total P&L, Win Rate, Sharpe Ratio, Profit Factor), a monthly P&L bar chart, and an instrument breakdown table showing per-instrument trade counts, win rates, and P&L contribution. All data comes from `GET /performance` and `GET /trades`.

### `/analytics`
Signal quality analysis across all instruments. Charts include: a P&L distribution histogram (bar chart of trade outcome buckets), win rate by instrument (horizontal bars), ML confidence vs outcome scatter plot (dots coloured by win/loss), and regime statistics table (trade count and win rate per regime state). Useful for identifying whether specific instruments or regimes are underperforming.

### `/ml`
ML model health dashboard. Displays one card per instrument (ES, NQ, GC), each showing: a circular accuracy progress dial, precision/recall/F1 scores, sample count and feature count, and the model file path. Also shows a 6-step training pipeline diagram explaining the workflow from data download through to model deployment. Data from `GET /ml/metrics`.

### `/journal`
Trade journal for reviewing individual live trades. Filter by instrument (All / ES / NQ / GC) using pill buttons. The table shows: instrument, side (LONG/SHORT with colour coding), entry time, exit time, entry price, exit price, P&L, P&L %, confluence score, ML confidence, and exit reason. Summary pills above the table show total trade count, overall win rate, and net P&L for the filtered view.

### `/controls`
Bot control panel: trading enable/disable toggle, risk parameter sliders, kill switch button (red, prominent), current bot state.

### `/login`
Full-screen login with animated logo. Credentials stored as bcrypt hash in `.env`.

---

## 13. Risk Management

### Position Sizing: Kelly Criterion

The Kelly Criterion determines the theoretically optimal fraction of capital to risk on each trade, given the historical win rate and payoff ratio.

**Formula:**
```
f* = (p × b − q) / b

Where:
  p = historical win rate (e.g., 0.55)
  q = 1 − p = loss rate (e.g., 0.45)
  b = avg_win / avg_loss = payoff ratio (e.g., 300/150 = 2.0)

Example:
  f* = (0.55 × 2.0 − 0.45) / 2.0
  f* = (1.10 − 0.45) / 2.0
  f* = 0.325 → capped at 0.25 (25% maximum)
```

The result is capped at **25%** to prevent excessive concentration. The Kelly fraction is then converted to contracts:

```python
risk_dollars = equity × kelly_fraction      # e.g., $100,000 × 0.15 = $15,000
stop_dollars = atr × 1.5 × point_value     # e.g., 10 × 1.5 × 50 = $750
contracts = int(risk_dollars / stop_dollars)  # e.g., 20 contracts
```

In practice, the minimum Kelly fraction is floored at `RISK_PCT` (1%) to ensure at least 1 contract is traded when the historical stats are poor.

### Daily Kill Switch

Every iteration, `risk.daily_kill_triggered(equity)` checks:

```python
drawdown = (peak_equity − current_equity) / peak_equity
if drawdown >= 0.03:  # 3% from daily high
    halt all trading for the next hour
```

This is a circuit breaker that prevents a bad day from becoming catastrophic. The bot resumes after 1 hour.

### Bracket Orders

Every trade is placed as a bracket: entry + stop + target simultaneously. Even if the bot crashes or loses connection, IBKR will automatically close the position when either level is hit. This is the most critical safety feature.

---

## 14. IBKR Integration

The bot uses **ib_insync**, a Pythonic async wrapper around the IBKR API.

### Connection

```python
ib = IB()
await ib.connectAsync(host=IBKR_HOST, port=IBKR_PORT, clientId=IBKR_CLIENT_ID)
```

**Ports:**
- `7497` — TWS paper trading account (use for testing)
- `7496` — TWS live account
- `4002` — IB Gateway paper (lighter weight, better for servers)
- `4001` — IB Gateway live

### Market Data

`get_bars(ib, instrument, barSize, duration)` requests historical OHLCV data:
- `barSize`: `"15 mins"`, `"1 hour"`, `"4 hours"`
- `duration`: `"5 D"` (5 days), `"30 D"`, `"90 D"`, `"365 D"`

Returns a pandas DataFrame with columns: `open, high, low, close, volume, datetime`.

### Order Placement

`place_bracket_order(ib, instrument, quantity, action, entry_price, stop_loss, take_profit)` creates and submits:
1. Parent order (limit order at `entry_price`)
2. Stop-loss child order (stop order at `stop_loss`)
3. Take-profit child order (limit order at `take_profit`)

All three orders are linked via `ocaGroup` — when one is filled or cancelled, the others are automatically cancelled.

---

## 15. Docker Deployment

For production or clean local development, the entire stack runs in Docker:

```bash
docker compose up -d
```

This starts all four services:

| Service | Image | Port | Description |
|---------|-------|------|-------------|
| `postgres` | postgres:15-alpine | 5432 | Database |
| `api` | ./api (Dockerfile) | 8000 | FastAPI |
| `bot` | ./bot (Dockerfile) | — | Trading bot |
| `dashboard` | ./dashboard (Dockerfile) | 3000 | Next.js |

**Important:** In Docker, `POSTGRES_HOST=postgres` (the Docker service name). When running API/bot locally outside Docker, change this to `localhost`.

The `bot` service uses `network_mode: host` to allow direct TCP connection to IBKR TWS running on the host machine (port 7497). This is necessary because the bot needs to reach `127.0.0.1:7497` on the host.

### Persistent Volumes

- `postgres_data` — database files survive `docker compose down`
- `ml_models` — trained model `.pkl` files shared between `api` and `bot`

To fully reset: `docker compose down -v` (deletes both volumes)

---

## 16. Security Model

### Authentication

The dashboard and API are protected by JWT (JSON Web Tokens):
1. User logs in with username + bcrypt-hashed password
2. API validates the hash, returns a signed JWT
3. All subsequent API requests include `Authorization: Bearer <token>`
4. Tokens expire after 24 hours

The JWT is signed with `JWT_SECRET` — a 256-bit hex string. Keep this secret.

### Credential Storage

- Passwords are stored as bcrypt hashes (never plaintext)
- The `.env` file contains all secrets — **never commit it to git**
- In production, use environment variables or a secrets manager instead of `.env`

### CORS

The API only allows requests from `http://localhost:3000` by default. Change `allow_origins` in `api/main.py` for your production domain.

---

## 17. Design Decisions & Trade-offs

### Why three instruments?

ES, NQ, and GC are among the most liquid futures markets. They span correlated (ES/NQ) and uncorrelated (GC) assets, giving the pairs monitor meaningful data. More instruments would dilute capital without proportional benefit.

### Why Kelly Criterion instead of fixed fractional sizing?

Fixed fractional (e.g., "always risk 1%") ignores the edge you have. Kelly directly maximises long-term geometric growth given your historical statistics. The 25% cap prevents the theoretical Kelly from over-concentrating (full Kelly can be extremely volatile in practice).

### Why HMM for regime detection instead of moving average filters?

Moving average trend filters (e.g., "price above 200-day MA = trend") are parameter-sensitive and lag-heavy. The HMM learns the statistical signature of different market regimes directly from returns data — it captures volatility clustering and momentum persistence simultaneously. The state assignment is data-driven, not rule-based.

### Why yfinance for backtesting instead of IBKR historical data?

IBKR's historical data API has strict limits: 1-hour bars are limited to ~90 days by default. yfinance provides up to 730 days of 1-hour bars freely with no authentication required. The trade-off is data quality (Yahoo Finance data can occasionally have gaps or errors), but for strategy validation, 2 years is far more valuable than 90 days.

### Why is the ML filter disabled in backtesting?

Using the current production ML models in backtesting would cause **lookahead bias**: the models were trained on data that includes the backtest period, so they would predict outcomes they effectively "know". Proper ML backtesting requires training the model only on data prior to the backtest window. This is a future improvement — for now, the backtest validates the technical signal quality without ML enhancement.

### Why subprocess for the backtest engine?

FastAPI workers are asyncio event loops. Running a CPU-bound, multi-minute computation in an async handler would block all other requests. Using `subprocess.Popen` gives true process isolation: the backtest runs in its own Python process, the API stays responsive, and any crash in the backtest doesn't affect the API. The alternative (Celery workers, background task queues) would add significant infrastructure complexity for a single use case.

### Why lightweight-charts instead of TradingView widgets?

lightweight-charts is open-source, runs entirely client-side with no API keys, and integrates natively into React with full programmatic control. TradingView widgets are easier to set up but have rate limits, vendor lock-in, and limited customisation.

---

*Documentation current as of April 2026. Built for paper trading account — validate thoroughly before using with a live account.*
