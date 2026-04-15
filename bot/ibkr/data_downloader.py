"""Downloads historical data from IBKR + yfinance for ML training."""
import os
import logging
import pandas as pd
import yfinance as yf
from ib_insync import IB
from ibkr.market_data import get_bars
from config import MODEL_DIR

log = logging.getLogger(__name__)

YFINANCE_SYMBOLS = {"ES": "/ES=F", "NQ": "/NQ=F", "GC": "/GC=F"}


async def download_ibkr_history(ib: IB, instrument: str, bar_size: str = "15 mins") -> pd.DataFrame:
    """Pull up to 1 year of 15m bars from IBKR."""
    log.info(f"Downloading IBKR history for {instrument} {bar_size}")
    df = await get_bars(ib, instrument, bar_size, "365 D")
    return df


def download_yfinance_history(instrument: str, period: str = "5y", interval: str = "1h") -> pd.DataFrame:
    """Pull multi-year hourly data from yfinance as supplement."""
    symbol = YFINANCE_SYMBOLS[instrument]
    log.info(f"Downloading yfinance history for {symbol}")
    df = yf.download(symbol, period=period, interval=interval, auto_adjust=True)
    df.columns = [c.lower() for c in df.columns]
    df.index = pd.to_datetime(df.index, utc=True)
    return df


def merge_and_save(instrument: str, ibkr_df: pd.DataFrame, yf_df: pd.DataFrame) -> pd.DataFrame:
    """Merge IBKR (recent, accurate) + yfinance (long history) data."""
    os.makedirs(MODEL_DIR, exist_ok=True)
    if not ibkr_df.empty:
        combined = pd.concat([yf_df, ibkr_df]).sort_index()
        combined = combined[~combined.index.duplicated(keep="last")]
    else:
        combined = yf_df

    path = os.path.join(MODEL_DIR, f"{instrument}_history.parquet")
    combined.to_parquet(path)
    log.info(f"Saved {len(combined)} rows for {instrument} to {path}")
    return combined
