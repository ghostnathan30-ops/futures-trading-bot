import pandas as pd
import numpy as np

def compute_order_flow(df: pd.DataFrame) -> pd.DataFrame:
    d = df.copy()
    if "ask_vol" in d.columns and "bid_vol" in d.columns:
        d["delta"] = d["ask_vol"] - d["bid_vol"]
    else:
        d["delta"] = np.where(
            d["close"] >= d["close"].shift(1),
            d["volume"] * 0.6,
            -d["volume"] * 0.6,
        )
    d["cumulative_delta"] = d["delta"].cumsum()
    d["delta_ma20"] = d["delta"].rolling(20).mean()
    price_higher = d["close"] > d["close"].rolling(5).max().shift(1)
    delta_lower  = d["cumulative_delta"] < d["cumulative_delta"].shift(5)
    d["delta_divergence_bearish"] = price_higher & delta_lower
    price_lower  = d["close"] < d["close"].rolling(5).min().shift(1)
    delta_higher = d["cumulative_delta"] > d["cumulative_delta"].shift(5)
    d["delta_divergence_bullish"] = price_lower & delta_higher
    d["delta_divergence"] = d["delta_divergence_bearish"] | d["delta_divergence_bullish"]
    return d
