import os
from dotenv import load_dotenv

load_dotenv()

# IBKR
IBKR_HOST = os.getenv("IBKR_HOST", "127.0.0.1")
IBKR_PORT = int(os.getenv("IBKR_PORT", 7497))
IBKR_CLIENT_ID = int(os.getenv("IBKR_CLIENT_ID", 1))

# Database
DB_URL = (
    f"postgresql+asyncpg://{os.getenv('POSTGRES_USER')}:"
    f"{os.getenv('POSTGRES_PASSWORD')}@{os.getenv('POSTGRES_HOST')}:"
    f"{os.getenv('POSTGRES_PORT')}/{os.getenv('POSTGRES_DB')}"
)
DB_URL_SYNC = DB_URL.replace("+asyncpg", "")

# Instruments
INSTRUMENTS = ["ES", "NQ", "GC"]
INSTRUMENT_EXCHANGE = {"ES": "CME", "NQ": "CME", "GC": "COMEX"}
INSTRUMENT_CURRENCY = {"ES": "USD", "NQ": "USD", "GC": "USD"}

# Strategy
TIMEFRAMES = ["15 mins", "1 hour", "4 hours"]
EMA_SHORT = 20
EMA_LONG = 50
EMA_TREND = 200
MACD_FAST = 12
MACD_SLOW = 26
MACD_SIGNAL = 9
RSI_PERIOD = 14
ATR_PERIOD = 14
CONFLUENCE_THRESHOLD = 5      # out of 6 — live trading (conservative)

# Risk
RISK_PCT = float(os.getenv("RISK_PCT", 0.01))
ATR_STOP_MULT = 1.5
ATR_TP_MULT = 3.0
DAILY_KILL_PCT = float(os.getenv("DAILY_KILL_PCT", 0.03))

# ── Backtest-specific parameters ─────────────────────────────────────────────
# More permissive than live trading to generate meaningful sample of trades.
# Regime gate is relaxed (score-based rather than hard block).
BACKTEST_CONFLUENCE_THRESHOLD = 3   # base threshold in trending regime
BACKTEST_REGIME_THRESHOLDS = {
    "trending":  3,   # full confidence — use base threshold
    "ranging":   4,   # be more selective — market is directionless
    "volatile":  5,   # very selective — wide spreads, erratic moves
}
# Per-instrument ATR multipliers (GC is slower/less volatile than ES/NQ)
BACKTEST_ATR_STOP_MULT: dict[str, float] = {"ES": 1.5, "NQ": 1.5, "GC": 1.2}
BACKTEST_ATR_TP_MULT:   dict[str, float] = {"ES": 3.0, "NQ": 3.5, "GC": 2.5}
BACKTEST_MAX_HOLD_BARS      = 48   # force-exit after 48 bars (~2 calendar days at 1h)
BACKTEST_MAX_HOLD_BARS_1D   = 20   # force-exit after 20 bars (~1 calendar month at 1d)
BACKTEST_WARMUP_BARS        = 200  # rolling indicator window (both timeframes)
# Trailing stop: activate once unrealized profit >= TRIGGER * atr; trail at DIST * atr
ATR_TRAIL_TRIGGER_MULT = 1.5
ATR_TRAIL_DIST_MULT    = 1.0

# ML
ML_MIN_CONFIDENCE = float(os.getenv("ML_MIN_CONFIDENCE", 0.65))
ML_RETRAIN_DAYS = 7
ML_LOOKBACK_YEARS = 3
MODEL_DIR = os.getenv("MODEL_DIR", "/app/ml_models")

# Logging
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
