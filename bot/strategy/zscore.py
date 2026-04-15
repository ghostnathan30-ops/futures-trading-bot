import pandas as pd

def compute_zscore(prices: pd.Series, window: int = 20) -> pd.Series:
    mean = prices.rolling(window).mean()
    std  = prices.rolling(window).std()
    return (prices - mean) / std.replace(0, float("nan"))

def zscore_signal(prices: pd.Series, window: int = 20, threshold: float = 2.0) -> str:
    z = compute_zscore(prices, window).iloc[-1]
    if z < -threshold:
        return "long"
    if z > threshold:
        return "short"
    return "neutral"
