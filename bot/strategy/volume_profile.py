import pandas as pd
import numpy as np


def compute_volume_profile(df: pd.DataFrame, bins: int = 50) -> pd.DataFrame:
    """Build volume-at-price profile for session."""
    lo = df["low"].min()
    hi = df["high"].max()
    price_bins = np.linspace(lo, hi, bins + 1)
    vol_at_price = np.zeros(bins)

    for _, row in df.iterrows():
        bar_lo, bar_hi = row["low"], row["high"]
        mask = (price_bins[:-1] <= bar_hi) & (price_bins[1:] >= bar_lo)
        n_bins = mask.sum()
        if n_bins > 0:
            vol_at_price[mask] += row["volume"] / n_bins

    mid_prices = (price_bins[:-1] + price_bins[1:]) / 2
    return pd.DataFrame({"price": mid_prices, "volume": vol_at_price})


def get_poc(profile: pd.DataFrame) -> float:
    """Return Point of Control — price level with highest volume."""
    return float(profile.loc[profile["volume"].idxmax(), "price"])


def get_value_area(profile: pd.DataFrame, pct: float = 0.70) -> tuple[float, float]:
    """Return Value Area Low/High containing pct% of volume."""
    total = profile["volume"].sum()
    target = total * pct
    poc_idx = profile["volume"].idxmax()
    lo_idx, hi_idx = poc_idx, poc_idx
    accumulated = profile.loc[poc_idx, "volume"]
    while accumulated < target:
        lo_vol = profile.loc[lo_idx - 1, "volume"] if lo_idx > 0 else 0
        hi_vol = profile.loc[hi_idx + 1, "volume"] if hi_idx < len(profile) - 1 else 0
        if lo_vol >= hi_vol and lo_idx > 0:
            lo_idx -= 1
            accumulated += lo_vol
        elif hi_idx < len(profile) - 1:
            hi_idx += 1
            accumulated += hi_vol
        else:
            break
    return float(profile.loc[lo_idx, "price"]), float(profile.loc[hi_idx, "price"])
