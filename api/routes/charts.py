from fastapi import APIRouter, Depends, HTTPException, Query
import pandas as pd
import yfinance as yf

from auth.routes import require_auth

router = APIRouter(prefix="/charts", tags=["charts"])

_TICKER_MAP: dict[str, str] = {"ES": "ES=F", "NQ": "NQ=F", "GC": "GC=F"}

# (yfinance interval, yfinance period)
_TF_CONFIG: dict[str, tuple[str, str]] = {
    "15m": ("15m", "5d"),
    "1h":  ("1h",  "30d"),
    "4h":  ("1h",  "60d"),   # fetch 1h bars, then resample to 4h on the server
}


@router.get("/bars")
async def get_bars(
    instrument: str = Query(..., description="ES, NQ, or GC"),
    timeframe: str = Query("15m", pattern="^(15m|1h|4h)$"),
    limit: int = Query(200, ge=10, le=500),
    _=Depends(require_auth),
):
    """Return OHLCV bars for the given futures instrument and timeframe."""
    ticker = _TICKER_MAP.get(instrument.upper())
    if ticker is None:
        raise HTTPException(status_code=400, detail=f"Unknown instrument '{instrument}'. Use ES, NQ, or GC.")

    yf_interval, period = _TF_CONFIG[timeframe]

    try:
        df: pd.DataFrame = yf.download(
            ticker,
            interval=yf_interval,
            period=period,
            progress=False,
            auto_adjust=True,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Market data fetch failed: {exc}")

    if df is None or df.empty:
        raise HTTPException(status_code=404, detail=f"No market data returned for {instrument}")

    # yfinance ≥ 0.2.x returns MultiIndex columns when downloading a single ticker;
    # flatten to plain column names (Open, High, Low, Close, Volume).
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    if timeframe == "4h":
        df = (
            df.resample("4h")
            .agg({"Open": "first", "High": "max", "Low": "min", "Close": "last", "Volume": "sum"})
            .dropna(subset=["Open", "Close"])
        )

    df = df.tail(limit).copy()

    bars = []
    for ts, row in df.iterrows():
        bars.append({
            "time":   int(pd.Timestamp(ts).timestamp()),
            "open":   round(float(row["Open"]),  4),
            "high":   round(float(row["High"]),  4),
            "low":    round(float(row["Low"]),   4),
            "close":  round(float(row["Close"]), 4),
            "volume": int(row["Volume"]),
        })

    return bars
