"""Downloads historical data from IBKR + yfinance + Nasdaq Data Link for ML training."""
import os
import logging
import pandas as pd
import yfinance as yf
from ib_insync import IB
from ibkr.market_data import get_bars
from config import MODEL_DIR, NASDAQ_API_KEY, NASDAQ_SYMBOLS

log = logging.getLogger(__name__)

# Standard continuous-futures symbols for yfinance (no leading slash)
YFINANCE_SYMBOLS = {"ES": "ES=F", "NQ": "NQ=F", "GC": "GC=F"}


async def download_ibkr_history(ib: IB, instrument: str, bar_size: str = "15 mins") -> pd.DataFrame:
    """Pull up to 60 days of 15m bars from IBKR.

    60 D keeps request size small and avoids timeouts outside market hours.
    yfinance provides the longer historical window for ML training.
    """
    log.info(f"Downloading IBKR history for {instrument} {bar_size}")
    df = await get_bars(ib, instrument, bar_size, "60 D")
    return df


def download_yfinance_history(instrument: str, period: str = "2y", interval: str = "1h") -> pd.DataFrame:
    """Pull 2-year hourly data from yfinance as supplement.

    Returns empty DataFrame if yfinance is unavailable or returns no data.
    Handles yfinance >=0.2.x MultiIndex columns (('Close', 'ES=F') tuples).
    """
    symbol = YFINANCE_SYMBOLS[instrument]
    log.info(f"Downloading yfinance history for {symbol}")
    try:
        df = yf.download(symbol, period=period, interval=interval,
                         auto_adjust=True, progress=False)
    except Exception as e:
        log.warning(f"yfinance download failed for {symbol}: {e}")
        return pd.DataFrame()

    if df.empty:
        log.warning(f"yfinance returned no data for {symbol}")
        return pd.DataFrame()

    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    df.columns = [c.lower() for c in df.columns]
    df.index = pd.to_datetime(df.index, utc=True)
    return df


def download_yfinance_daily(instrument: str) -> pd.DataFrame:
    """Pull max available daily bars from yfinance (20+ years for ES/NQ/GC).

    Provides long-term trend context for ML feature engineering.
    """
    symbol = YFINANCE_SYMBOLS[instrument]
    log.info(f"Downloading yfinance daily history for {symbol}")
    try:
        df = yf.download(symbol, period="max", interval="1d",
                         auto_adjust=True, progress=False)
    except Exception as e:
        log.warning(f"yfinance daily download failed for {symbol}: {e}")
        return pd.DataFrame()

    if df.empty:
        log.warning(f"yfinance daily returned no data for {symbol}")
        return pd.DataFrame()

    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    df.columns = [c.lower() for c in df.columns]
    df.index = pd.to_datetime(df.index, utc=True)
    return df


def download_nasdaq_daily(instrument: str) -> pd.DataFrame:
    """Pull daily continuous-futures data from Nasdaq Data Link (free tier).

    ES back to 1997, NQ to 1996, GC to 1975.
    Requires NASDAQ_API_KEY in .env — sign up free at data.nasdaq.com.
    Skipped gracefully if key is not set.
    """
    if not NASDAQ_API_KEY:
        log.info(f"NASDAQ_API_KEY not set — skipping Nasdaq Data Link for {instrument}")
        return pd.DataFrame()

    dataset = NASDAQ_SYMBOLS[instrument]
    log.info(f"Downloading Nasdaq Data Link history for {dataset}")
    try:
        import nasdaqdatalink
        nasdaqdatalink.ApiConfig.api_key = NASDAQ_API_KEY
        df = nasdaqdatalink.get(dataset)
    except Exception as e:
        log.warning(f"Nasdaq Data Link download failed for {dataset}: {e}")
        return pd.DataFrame()

    if df.empty:
        log.warning(f"Nasdaq Data Link returned no data for {dataset}")
        return pd.DataFrame()

    # Normalize: Nasdaq returns Title Case columns with spaces
    df.columns = [c.lower().replace(" ", "_") for c in df.columns]
    # CHRIS CME datasets use 'Last' or 'Settle' for close price
    rename_map = {"last": "close", "settle": "close"}
    df = df.rename(columns={k: v for k, v in rename_map.items() if k in df.columns})

    needed = {"open", "high", "low", "close", "volume"}
    missing = needed - set(df.columns)
    if missing:
        log.warning(f"Nasdaq Data Link {dataset} missing columns {missing} — skipping")
        return pd.DataFrame()

    df = df[list(needed)].copy()
    df.index = pd.to_datetime(df.index, utc=True)
    df = df.sort_index()
    return df


def merge_and_save(
    instrument: str,
    ibkr_df: pd.DataFrame,
    yf_1h_df: pd.DataFrame,
    yf_daily_df: pd.DataFrame = None,
    nasdaq_df: pd.DataFrame = None,
) -> pd.DataFrame:
    """Merge all data sources (oldest → newest); duplicates resolved by keep='last'.

    Source priority (latest value wins on timestamp duplicates):
      nasdaq_daily (oldest, longest history) →
      yf_daily (20yr daily) →
      yf_1h (2yr hourly) →
      ibkr_15m (newest, most accurate intraday)
    """
    frames = [f for f in [nasdaq_df, yf_daily_df, yf_1h_df, ibkr_df]
              if f is not None and not f.empty]
    if not frames:
        log.warning(f"No data available for {instrument} — skipping save")
        return pd.DataFrame()

    os.makedirs(MODEL_DIR, exist_ok=True)
    combined = pd.concat(frames).sort_index()
    combined = combined[~combined.index.duplicated(keep="last")]

    path = os.path.join(MODEL_DIR, f"{instrument}_history.parquet")
    combined.to_parquet(path)
    log.info(f"Saved {len(combined)} rows for {instrument} to {path}")

    # Save a daily-only parquet for ML daily-feature join (used by feature_engineering.py)
    daily_frames = [f for f in [nasdaq_df, yf_daily_df] if f is not None and not f.empty]
    if daily_frames:
        daily = pd.concat(daily_frames).sort_index()
        daily = daily[~daily.index.duplicated(keep="last")]
        daily_path = os.path.join(MODEL_DIR, f"{instrument}_daily.parquet")
        daily.to_parquet(daily_path)
        log.info(f"Saved {len(daily)} daily rows for {instrument} to {daily_path}")

    return combined
