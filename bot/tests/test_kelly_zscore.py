from strategy.kelly import kelly_fraction, position_size_contracts
from strategy.zscore import compute_zscore, zscore_signal

def test_kelly_fraction_basic():
    f = kelly_fraction(win_rate=0.6, avg_win=300.0, avg_loss=200.0)
    assert 0 < f < 0.5

def test_kelly_zero_edge():
    f = kelly_fraction(win_rate=0.4, avg_win=100.0, avg_loss=200.0)
    assert f == 0.0

def test_position_size_contracts():
    contracts = position_size_contracts(equity=100_000, kelly_f=0.05, atr=10.0, atr_stop_mult=1.5, point_value=50.0)
    assert contracts >= 1

def test_zscore_signal_long():
    import pandas as pd
    prices = pd.Series([100.0] * 50 + [85.0])
    sig = zscore_signal(prices, window=20, threshold=2.0)
    assert sig == "long"

def test_zscore_signal_neutral():
    import pandas as pd, numpy as np
    np.random.seed(1)
    prices = pd.Series(100.0 + np.random.randn(50) * 0.1)
    sig = zscore_signal(prices, window=20, threshold=2.0)
    assert sig == "neutral"
