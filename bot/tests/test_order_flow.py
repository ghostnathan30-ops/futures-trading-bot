import pandas as pd
import numpy as np
from strategy.order_flow import compute_order_flow

def test_delta_computed():
    df = pd.DataFrame({
        "close": [100, 101, 100.5],
        "volume": [1000, 1200, 800],
        "ask_vol": [600, 800, 300],
        "bid_vol": [400, 400, 500],
    })
    result = compute_order_flow(df)
    assert "delta" in result.columns
    assert "cumulative_delta" in result.columns
    assert result["delta"].iloc[0] == 200

def test_divergence_detected():
    n = 20
    df = pd.DataFrame({
        "close": list(range(100, 100 + n)),
        "volume": [1000] * n,
        "ask_vol": [400] * n,
        "bid_vol": [600] * n,
    })
    result = compute_order_flow(df)
    assert "delta_divergence" in result.columns
