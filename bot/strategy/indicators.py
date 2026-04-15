import pandas as pd
import numpy as np
import ta

def compute_indicators(df: pd.DataFrame) -> pd.DataFrame:
    d = df.copy()
    # EMAs via pandas ewm (gives values from row 0, no NaN fill requirement)
    d["ema20"]  = d["close"].ewm(span=20, adjust=False).mean()
    d["ema50"]  = d["close"].ewm(span=50, adjust=False).mean()
    d["ema200"] = d["close"].ewm(span=200, adjust=False).mean()
    # MACD
    macd = ta.trend.MACD(d["close"], window_slow=26, window_fast=12, window_sign=9)
    d["macd"]        = macd.macd()
    d["macd_signal"] = macd.macd_signal()
    d["macd_hist"]   = macd.macd_diff()
    # RSI
    d["rsi"] = ta.momentum.rsi(d["close"], window=14)
    # ATR - replace zeros with NaN for initial period
    atr_raw = ta.volatility.average_true_range(d["high"], d["low"], d["close"], window=14)
    d["atr"] = atr_raw.replace(0, np.nan)
    d["atr_pct"] = d["atr"] / d["close"]
    d["atr_mean20"]   = d["atr"].rolling(20).mean()
    d["atr_trending"] = d["atr"] > d["atr_mean20"]
    return d
