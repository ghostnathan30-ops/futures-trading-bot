import pandas as pd
import numpy as np
from ml.feature_engineering import build_features, FEATURE_COLS


def test_feature_columns_present():
    n = 300
    np.random.seed(42)
    prices = 5000 + np.cumsum(np.random.randn(n) * 5)
    df = pd.DataFrame({
        "open": prices - 2, "high": prices + 5,
        "low": prices - 5, "close": prices,
        "volume": np.random.randint(1000, 5000, n),
    })
    result = build_features(df)
    for col in FEATURE_COLS:
        assert col in result.columns, f"Missing feature: {col}"


def test_target_binary():
    n = 300
    np.random.seed(42)
    prices = 5000 + np.cumsum(np.random.randn(n) * 5)
    df = pd.DataFrame({
        "open": prices - 2, "high": prices + 5,
        "low": prices - 5, "close": prices,
        "volume": np.random.randint(1000, 5000, n),
    })
    result = build_features(df)
    assert set(result["target"].unique()).issubset({0, 1})
