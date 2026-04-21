"""Downloads historical data from IBKR + yfinance for ML training."""
import os
import logging
import pandas as pd
import yfinance as yf
from ib_insync import IB
from ibkr.market_data import get_bars
from config import MODEL_DIR

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
    """Pull multi-year hourly data from yfinance as supplement.

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

    # yfinance >=0.2.x returns MultiIndex columns: ('Close', 'ES=F')
    # Flatten to plain strings before lowercasing
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    df.columns = [c.lower() for c in df.columns]
    df.index = pd.to_datetime(df.index, utc=True)
    return df


def merge_and_save(instrument: str, ibkr_df: pd.DataFrame, yf_df: pd.DataFrame) -> pd.DataFrame:
    """Merge IBKR (recent, accurate) + yfinance (long history) data."""
    frames = [f for f in [yf_df, ibkr_df] if not f.empty]
    if not frames:
        log.warning(f"No data available for {instrument} — skipping save")
        return pd.DataFrame()

    os.makedirs(MODEL_DIR, exist_ok=True)

    combined = pd.concat(frames).sort_index()
    combined = combined[~combined.index.duplicated(keep="last")]

    path = os.path.join(MODEL_DIR, f"{instrument}_history.parquet")
    combined.to_parquet(path)
    log.info(f"Saved {len(combined)} rows for {instrument} to {path}")
    return combined
