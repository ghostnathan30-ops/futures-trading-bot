import pandas as pd
import numpy as np

def compute_vwap(df: pd.DataFrame) -> pd.DataFrame:
    d = df.copy()
    typical = (d["high"] + d["low"] + d["close"]) / 3
    cum_vol = d["volume"].cumsum()
    cum_tp_vol = (typical * d["volume"]).cumsum()
    d["vwap"] = cum_tp_vol / cum_vol
    cum_tp2_vol = ((typical ** 2) * d["volume"]).cumsum()
    variance = (cum_tp2_vol / cum_vol) - (d["vwap"] ** 2)
    variance = variance.clip(lower=0)
    std = np.sqrt(variance)
    for n in [1, 2, 3]:
        d[f"vwap_upper{n}"] = d["vwap"] + n * std
        d[f"vwap_lower{n}"] = d["vwap"] - n * std
    d["vwap_std"] = std
    d["price_vs_vwap"] = (d["close"] - d["vwap"]) / std.replace(0, np.nan)
    return d
