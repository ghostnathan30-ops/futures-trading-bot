import pandas as pd
import numpy as np
from strategy.indicators import compute_indicators
from strategy.vwap import compute_vwap
from strategy.order_flow import compute_order_flow
from strategy.zscore import compute_zscore

FEATURE_COLS = [
    "ema20_50_cross", "ema50_200_cross", "price_vs_ema20", "price_vs_vwap",
    "rsi_norm", "macd_hist_norm", "atr_ratio", "zscore_20",
    "delta_norm", "cum_delta_slope", "vol_ratio",
]

def build_features(df: pd.DataFrame) -> pd.DataFrame:
    d = compute_indicators(df)
    d = compute_vwap(d)
    d = compute_order_flow(d)
    d["ema20_50_cross"]  = (d["ema20"] - d["ema50"]) / d["close"]
    d["ema50_200_cross"] = (d["ema50"] - d["ema200"]) / d["close"]
    d["price_vs_ema20"]  = (d["close"] - d["ema20"]) / d["atr"]
    d["price_vs_vwap"]   = (d["close"] - d["vwap"]) / d["atr"].replace(0, np.nan)
    d["rsi_norm"]        = (d["rsi"] - 50) / 50
    d["macd_hist_norm"]  = d["macd_hist"] / d["atr"].replace(0, np.nan)
    d["atr_ratio"]       = d["atr"] / d["atr_mean20"]
    d["zscore_20"]       = compute_zscore(d["close"], window=20)
    d["delta_norm"]      = d["delta"] / d["volume"].replace(0, np.nan)
    d["cum_delta_slope"] = d["cumulative_delta"].diff(5)
    d["vol_ratio"]       = d["volume"] / d["volume"].rolling(20).mean()
    d["future_return"]   = d["close"].shift(-3) - d["close"]
    d["target"]          = (d["future_return"] > 0.5 * d["atr"]).astype(int)
    return d[FEATURE_COLS + ["target"]].dropna()
