import pandas as pd
import numpy as np
from strategy.vwap import compute_vwap

def session_df():
    n = 50
    np.random.seed(1)
    prices = 5000 + np.cumsum(np.random.randn(n) * 3)
    idx = pd.date_range("2026-04-14 09:30", periods=n, freq="15min", tz="US/Eastern")
    return pd.DataFrame({
        "high": prices + 2, "low": prices - 2,
        "close": prices, "volume": np.random.randint(500, 2000, n),
    }, index=idx)

def test_vwap_columns():
    result = compute_vwap(session_df())
    for col in ["vwap", "vwap_upper1", "vwap_lower1", "vwap_upper2", "vwap_lower2"]:
        assert col in result.columns

def test_vwap_bands_symmetric():
    result = compute_vwap(session_df()).dropna()
    diff_upper = (result["vwap_upper1"] - result["vwap"]).round(4)
    diff_lower = (result["vwap"] - result["vwap_lower1"]).round(4)
    pd.testing.assert_series_equal(diff_upper, diff_lower, check_names=False)
