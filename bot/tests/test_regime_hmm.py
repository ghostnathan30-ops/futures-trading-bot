import numpy as np
import pandas as pd
from strategy.regime_hmm import RegimeDetector

def test_regime_detector_fits_and_predicts():
    np.random.seed(42)
    returns = np.random.randn(500) * 0.01
    df = pd.DataFrame({"close": 5000 + np.cumsum(returns * 100)})
    detector = RegimeDetector(n_states=3)
    detector.fit(df)
    state = detector.predict(df)
    assert state in ["trending", "ranging", "volatile"]

def test_regime_detector_consistent_across_calls():
    np.random.seed(42)
    returns = np.random.randn(500) * 0.01
    df = pd.DataFrame({"close": 5000 + np.cumsum(returns * 100)})
    detector = RegimeDetector(n_states=3)
    detector.fit(df)
    s1 = detector.predict(df)
    s2 = detector.predict(df)
    assert s1 == s2
