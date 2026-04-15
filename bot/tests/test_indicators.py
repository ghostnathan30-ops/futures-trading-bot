import pandas as pd
import numpy as np
import pytest
from strategy.indicators import compute_indicators

@pytest.fixture
def sample_df():
    n = 100
    np.random.seed(42)
    prices = 5000 + np.cumsum(np.random.randn(n) * 5)
    return pd.DataFrame({
        "open": prices - 2, "high": prices + 5,
        "low": prices - 5, "close": prices,
        "volume": np.random.randint(1000, 5000, n),
    })

def test_indicators_returns_required_columns(sample_df):
    result = compute_indicators(sample_df)
    required = ["ema20", "ema50", "ema200", "macd", "macd_signal", "macd_hist", "rsi", "atr", "atr_pct"]
    for col in required:
        assert col in result.columns, f"Missing column: {col}"

def test_ema20_shorter_than_ema50(sample_df):
    result = compute_indicators(sample_df)
    last = result.dropna().iloc[-1]
    assert isinstance(last["ema20"], float)
    assert isinstance(last["ema50"], float)

def test_rsi_bounded(sample_df):
    result = compute_indicators(sample_df)
    rsi = result["rsi"].dropna()
    assert (rsi >= 0).all() and (rsi <= 100).all()

def test_atr_positive(sample_df):
    result = compute_indicators(sample_df)
    atr = result["atr"].dropna()
    assert (atr > 0).all()
