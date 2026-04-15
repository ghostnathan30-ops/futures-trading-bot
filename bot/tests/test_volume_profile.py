import pandas as pd
import numpy as np
from strategy.volume_profile import compute_volume_profile, get_poc

def test_poc_within_price_range():
    np.random.seed(7)
    n = 100
    prices = 5000 + np.cumsum(np.random.randn(n) * 5)
    df = pd.DataFrame({
        "high": prices + 3, "low": prices - 3,
        "close": prices, "volume": np.random.randint(500, 3000, n),
    })
    profile = compute_volume_profile(df)
    poc = get_poc(profile)
    assert df["low"].min() <= poc <= df["high"].max()

def test_profile_has_price_and_volume():
    n = 50
    df = pd.DataFrame({
        "high": range(100, 150), "low": range(98, 148),
        "close": range(99, 149), "volume": [1000] * n,
    })
    profile = compute_volume_profile(df, bins=20)
    assert "price" in profile.columns and "volume" in profile.columns
    assert len(profile) == 20
