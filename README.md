# Futures Trading Bot

An automated algorithmic trading system for US equity index and gold futures markets. Connects to Interactive Brokers (IBKR), analyses market conditions across multiple timeframes, and executes bracket orders when a confluence of signals aligns. Includes a real-time Next.js dashboard and a FastAPI backend.

![Python](https://img.shields.io/badge/Python-3.11-blue?style=flat-square&logo=python)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![FastAPI](https://img.shields.io/badge/FastAPI-latest-009688?style=flat-square&logo=fastapi)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-latest-336791?style=flat-square&logo=postgresql)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker)

## What It Trades

| Instrument | Name | Exchange | Point Value |
|------------|------|----------|-------------|
| ES | E-mini S&P 500 | CME | $50/pt |
| NQ | E-mini Nasdaq-100 | CME | $20/pt |
| GC | Gold | COMEX | $100/pt |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Trading Bot (Python)               │
│  Market Data → Signals → ML Filter → Risk → Orders  │
└──────────────────────┬──────────────────────────────┘
                       │ PostgreSQL
┌──────────────────────▼──────────────────────────────┐
│              FastAPI Backend + WebSocket              │
└──────────────────────┬──────────────────────────────┘
                       │ WebSocket / REST
┌──────────────────────▼──────────────────────────────┐
│           Next.js Dashboard (real-time UI)           │
└─────────────────────────────────────────────────────┘
```

## Features

### Trading Engine (`/bot`)
- **Multi-signal confluence** — VWAP, EMA/MACD/RSI/ATR, order flow delta, cumulative delta, HMM regime detection
- **3-state regime detection** — HMM model classifying market as trending / ranging / volatile
- **ML filter** — LightGBM walk-forward model filters low-probability setups
- **Kelly Criterion position sizing** with z-score entry triggers
- **ES/NQ pairs spread monitor** with z-score signal
- **Bracket orders** — entry + stop-loss + take-profit sent atomically to IBKR
- **Crash recovery** — exponential backoff restart loop
- **Backtesting engine** with historical data replay

### API (`/api`)
- **FastAPI** with JWT authentication
- Full **REST API** — positions, orders, performance, analytics, ML, journal
- **WebSocket broadcaster** — live data pipeline to dashboard
- **PostgreSQL** with async writer

### Dashboard (`/dashboard`)
- Real-time **trading charts** and positions table
- **Overview page** with P&L, risk panel, time & sales
- **Controls page** — kill switch, manual overrides
- **Performance & analytics** pages
- **ML insights** and **trade journal**

## Tech Stack

| Layer | Tech |
|-------|------|
| Bot | Python 3.11, ibapi, LightGBM, pandas, NumPy |
| API | FastAPI, SQLAlchemy (async), asyncpg, JWT |
| Database | PostgreSQL |
| Dashboard | Next.js 14, TypeScript, Tailwind CSS |
| Infrastructure | Docker Compose |

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL
- Interactive Brokers TWS or IB Gateway (paper trading supported)
- Docker (optional)

### Setup

```bash
# Clone the repo
git clone https://github.com/ghostnathan30/futures-trading-bot.git
cd futures-trading-bot

# Copy and configure environment
cp .env.example .env
# Edit .env with your IBKR credentials and DB config
```

### Running with Docker

```bash
docker-compose up --build
```

### Running manually

```bash
# 1. Start the bot
cd bot && pip install -r requirements.txt
python main.py

# 2. Start the API
cd api && pip install -r requirements.txt
uvicorn main:app --reload

# 3. Start the dashboard
cd dashboard && npm install && npm run dev
```

Dashboard runs at [http://localhost:3000](http://localhost:3000)
API docs at [http://localhost:8000/docs](http://localhost:8000/docs)

## Configuration

All configuration lives in `.env` (copy from `.env.example`):

```
IBKR_HOST=127.0.0.1
IBKR_PORT=7497         # 7497 = paper, 7496 = live
IBKR_CLIENT_ID=1
DB_URL=postgresql+asyncpg://user:pass@localhost/tradingbot
JWT_SECRET=<your-secret>
```

## Project Structure

```
├── bot/                  # Trading engine (Python)
│   ├── main.py           # Entry point + restart loop
│   ├── config.py         # Config loading
│   ├── ibkr/             # IBKR API wrapper
│   ├── strategy/         # Signal generators + confluence engine
│   ├── ml/               # LightGBM model, feature engineering
│   ├── backtest/         # Backtesting engine
│   ├── db/               # Async PostgreSQL writer
│   └── tests/
├── api/                  # FastAPI backend
│   ├── main.py
│   ├── routes/           # REST endpoints
│   ├── websocket/        # Live data broadcaster
│   ├── auth/             # JWT auth
│   └── db/
├── dashboard/            # Next.js real-time dashboard
│   ├── app/              # App Router pages
│   └── components/
├── docker-compose.yml
├── .env.example
└── DOCUMENTATION.md      # Full technical reference
```

## ⚠️ Disclaimer

This software is for educational and research purposes. Algorithmic trading involves significant financial risk. Never trade with money you cannot afford to lose. Always test thoroughly on paper trading before going live.

## License

MIT
