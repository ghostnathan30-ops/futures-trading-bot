import pandas as pd
import numpy as np
from strategy.pairs_monitor import PairsMonitor

def test_spread_computed():
    np.random.seed(99)
    n = 100
    es = pd.Series(5000 + np.cumsum(np.random.randn(n)))
    nq = pd.Series(19000 + np.cumsum(np.random.randn(n) * 3.8))
    monitor = PairsMonitor(window=30, threshold=2.0)
    signal = monitor.evaluate(es, nq)
    assert signal in ["long_es_short_nq", "long_nq_short_es", "neutral"]

def test_spread_neutral_when_correlated():
    np.random.seed(42)
    n = 100
    base = np.cumsum(np.random.randn(n))
    es = pd.Series(5000 + base * 10)
    nq = pd.Series(19000 + base * 38)
    monitor = PairsMonitor(window=30, threshold=2.0)
    signal = monitor.evaluate(es, nq)
    assert signal == "neutral"
