"""
Data loading utilities for the backtest engine.

Supports hourly (2yr max) and daily (25yr+) bars with local Parquet caching.
Cache lives at bot/data/ — downloaded once, reused on every run.

Uses yfinance directly (no ib_insync dependency) so this module can be
imported without a running TWS connection.
"""
import os
import logging
from datetime import datetime, timedelta

import pandas as pd
import yfinance as yf

log = logging.getLogger(__name__)

YFINANCE_SYMBOLS = {"ES": "ES=F", "NQ": "NQ=F", "GC": "GC=F"}
POINT_VALUES     = {"ES": 50,       "NQ": 20,       "GC": 100}

# Local cache — one Parquet file per instrument/interval
DATA_CACHE_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "data"))
_CACHE_MAX_AGE = {
    "1h": timedelta(hours=4),   # hourly data: refresh if > 4h old
    "1d": timedelta(hours=24),  # daily data:  refresh if > 24h old
}


def _cache_path(instrument: str, interval: str) -> str:
    os.makedirs(DATA_CACHE_DIR, exist_ok=True)
    return os.path.join(DATA_CACHE_DIR, f"{instrument}_{interval}.parquet")


def _cache_is_fresh(path: str, interval: str) -> bool:
    if not os.path.exists(path):
        return False
    age = datetime.now() - datetime.fromtimestamp(os.path.getmtime(path))
    return age < _CACHE_MAX_AGE.get(interval, timedelta(hours=24))


def _normalize(raw: pd.DataFrame, instrument: str, interval: str, desc: str) -> pd.DataFrame:
    """Flatten columns, drop bad rows, normalise to UTC DatetimeIndex."""
    if raw.empty:
        sym = YFINANCE_SYMBOLS[instrument]
        raise ValueError(f"yfinance returned no data for {sym} ({desc})")
    if isinstance(raw.columns, pd.MultiIndex):
        raw.columns = [c[0].lower() for c in raw.columns]
    else:
        raw.columns = [c.lower() for c in raw.columns]
    df = raw[["open", "high", "low", "close", "volume"]].copy()
    df.index = pd.to_datetime(df.index, utc=True)
    df = df.dropna(subset=["close"])
    df = df[df["volume"] > 0]
    df = df.sort_index()
    df["datetime"] = df.index
    return df


def fetch_1h_bars(instrument: str, period: str = "2y") -> pd.DataFrame:
    """
    Download hourly OHLCV bars (yfinance cap: ~730 days = 2yr).
    Results are cached to bot/data/; re-downloaded only when > 4h old.

    Returns a UTC-indexed DataFrame with columns:
        open, high, low, close, volume, datetime
    """
    interval = "1h"
    cache    = _cache_path(instrument, interval)

    if _cache_is_fresh(cache, interval):
        log.info(f"Loading {instrument} 1h bars from cache")
        df = pd.read_parquet(cache)
        log.info(f"  {len(df)} bars  {df.index[0].date()} → {df.index[-1].date()}")
        return df

    sym = YFINANCE_SYMBOLS[instrument]
    log.info(f"Downloading yfinance {period} 1h bars for {sym}")
    raw = yf.download(sym, period=period, interval=interval, auto_adjust=True, progress=False)
    df  = _normalize(raw, instrument, interval, f"period={period} interval=1h")
    df.to_parquet(cache)
    log.info(f"Downloaded + cached {len(df)} 1h bars for {instrument} "
             f"({df.index[0].date()} → {df.index[-1].date()})")
    return df


def fetch_1d_bars(instrument: str, period: str = "max") -> pd.DataFrame:
    """
    Download daily OHLCV bars — up to 25 years of history.
    Results are cached to bot/data/; re-downloaded only when > 24h old.

    Returns a UTC-indexed DataFrame with columns:
        open, high, low, close, volume, datetime
    """
    interval = "1d"
    cache    = _cache_path(instrument, interval)

    if _cache_is_fresh(cache, interval):
        log.info(f"Loading {instrument} 1d bars from cache")
        df = pd.read_parquet(cache)
        log.info(f"  {len(df)} bars  {df.index[0].date()} → {df.index[-1].date()}")
        return df

    sym = YFINANCE_SYMBOLS[instrument]
    log.info(f"Downloading yfinance {period} 1d bars for {sym}")
    raw = yf.download(sym, period=period, interval=interval, auto_adjust=True, progress=False)
    df  = _normalize(raw, instrument, interval, f"period={period} interval=1d")
    df.to_parquet(cache)
    log.info(f"Downloaded + cached {len(df)} 1d bars for {instrument} "
             f"({df.index[0].date()} → {df.index[-1].date()})")
    return df


def resample_to_4h(df_1h: pd.DataFrame) -> pd.DataFrame:
    """
    Aggregate 1h bars into 4h bars using standard OHLCV rules.
    Label/closed='left': the 08:00 bar covers 08:00–11:00.
    """
    ohlcv = df_1h.resample("4h", label="left", closed="left").agg({
        "open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum",
    }).dropna(subset=["close"])
    ohlcv = ohlcv[ohlcv["volume"] > 0]
    ohlcv["datetime"] = ohlcv.index
    return ohlcv


def resample_to_weekly(df_1d: pd.DataFrame) -> pd.DataFrame:
    """
    Aggregate daily bars into 5-day (weekly) bars.
    Used as the 4H-equivalent trend context when backtesting on daily bars.
    Label='left' so the Monday bar aggregates Mon–Fri data.
    """
    ohlcv = df_1d.resample("5D", label="left", closed="left").agg({
        "open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum",
    }).dropna(subset=["close"])
    ohlcv = ohlcv[ohlcv["volume"] > 0]
    ohlcv["datetime"] = ohlcv.index
    return ohlcv


def slice_window(df: pd.DataFrame, end_idx: int, warmup: int = 200) -> pd.DataFrame:
    """
    Return a rolling window of df ending at end_idx (inclusive).

    Always returns a fresh copy so cumulative indicators (VWAP, order flow)
    reset to the start of the window — matching live bot session behaviour.
    """
    start = max(0, end_idx - warmup + 1)
    return df.iloc[start: end_idx + 1].copy()


def get_data_info() -> dict:
    """
    Return a summary dict of all cached data ranges.
    Used by the API to show users what history is on disk.

    Returns:
        {
          "ES": {
            "1h": {"bars": 11388, "start": "2024-04-21", "end": "2026-04-21", "fresh": True},
            "1d": {"bars": 6460,  "start": "2000-09-18", "end": "2026-04-20", "fresh": False},
          },
          ...
        }
    """
    info: dict = {}
    for instr in YFINANCE_SYMBOLS:
        info[instr] = {}
        for interval in ("1h", "1d"):
            path = _cache_path(instr, interval)
            if os.path.exists(path):
                try:
                    df = pd.read_parquet(path, columns=["close"])
                    info[instr][interval] = {
                        "bars":  len(df),
                        "start": str(df.index[0].date()),
                        "end":   str(df.index[-1].date()),
                        "fresh": _cache_is_fresh(path, interval),
                    }
                except Exception:
                    info[instr][interval] = {"bars": 0, "fresh": False}
            else:
                info[instr][interval] = {"bars": 0, "fresh": False}
    return info
