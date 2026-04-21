import pandas as pd
import numpy as np
from strategy.indicators import compute_indicators
from strategy.vwap import compute_vwap
from strategy.order_flow import compute_order_flow
from strategy.zscore import compute_zscore

# Original 11 price/volume features
_BASE_FEATURE_COLS = [
    "ema20_50_cross", "ema50_200_cross", "price_vs_ema20", "price_vs_vwap",
    "rsi_norm", "macd_hist_norm", "atr_ratio", "zscore_20",
    "delta_norm", "cum_delta_slope", "vol_ratio",
]

# 4 daily-bar context features (joined from daily parquet via merge_asof)
_DAILY_FEATURE_COLS = [
    "daily_ema_cross",   # (daily_ema20 - daily_ema50) / daily_close — daily trend alignment
    "daily_rsi_norm",    # (daily_rsi - 50) / 50 — daily momentum direction
    "daily_atr_ratio",   # daily_atr / daily_atr_mean20 — daily volatility vs average
    "daily_vol_ratio",   # daily_volume / daily_volume_ma20 — daily volume expansion
]

# 2 regime/volatility features
_REGIME_FEATURE_COLS = [
    "regime_code",    # 0=ranging, 1=trending, 2=volatile (ordinal encoding)
    "atr_trending",   # 1 if current ATR > ATR 20-bar MA (local volatility expansion)
]

FEATURE_COLS = _BASE_FEATURE_COLS + _DAILY_FEATURE_COLS + _REGIME_FEATURE_COLS

_REGIME_CODE = {"ranging": 0, "trending": 1, "volatile": 2}


def _add_daily_features(df: pd.DataFrame, df_daily: pd.DataFrame) -> pd.DataFrame:
    """Join daily-bar indicator features onto intraday bars via merge_asof.

    Each intraday bar gets the most recent prior daily bar's feature values
    (forward-fill). Prevents look-ahead: daily close from day T is only
    available from bar T+1 onwards.
    """
    d = compute_indicators(df_daily.copy())
    vol_ma20 = d["volume"].rolling(20).mean().replace(0, 1)
    daily_feats = pd.DataFrame({
        "daily_ema_cross": (d["ema20"] - d["ema50"]) / d["close"].replace(0, np.nan),
        "daily_rsi_norm":  (d["rsi"] - 50) / 50,
        "daily_atr_ratio": d["atr"] / d["atr_mean20"].replace(0, 1),
        "daily_vol_ratio": d["volume"] / vol_ma20,
    }, index=d.index).dropna(how="all")

    df = df.sort_index()
    daily_feats = daily_feats.sort_index()
    merged = pd.merge_asof(
        df.reset_index(), daily_feats.reset_index(),
        on="date", direction="backward",
        suffixes=("", "_daily"),
    ).set_index("date")
    return merged


def _add_regime_features(df: pd.DataFrame, regime: str) -> pd.DataFrame:
    df = df.copy()
    df["regime_code"] = _REGIME_CODE.get(regime, 1)
    if "atr_trending" in df.columns:
        df["atr_trending"] = df["atr_trending"].astype(int)
    else:
        df["atr_trending"] = (df["atr"] > df["atr_mean20"]).astype(int)
    return df


def build_features(
    df: pd.DataFrame,
    df_daily: pd.DataFrame = None,
    regime: str = "trending",
) -> pd.DataFrame:
    """Build ML feature matrix from intraday bars.

    Args:
        df: Intraday OHLCV bars (15m or 1h).
        df_daily: Optional daily bars for higher-timeframe context features.
                  If None, daily feature columns are filled with 0 (neutral).
        regime: Current regime label ("ranging", "trending", "volatile").
                Used to encode the regime_code feature.

    Returns:
        DataFrame with FEATURE_COLS + "target" column, NaN rows dropped.
    """
    d = compute_indicators(df)
    d = compute_vwap(d)
    d = compute_order_flow(d)

    # Base features
    d["ema20_50_cross"]  = (d["ema20"] - d["ema50"]) / d["close"]
    d["ema50_200_cross"] = (d["ema50"] - d["ema200"]) / d["close"]
    d["price_vs_ema20"]  = (d["close"] - d["ema20"]) / d["atr"]
    d["price_vs_vwap"]   = (d["close"] - d["vwap"]) / d["atr"].replace(0, np.nan)
    d["rsi_norm"]        = (d["rsi"] - 50) / 50
    d["macd_hist_norm"]  = d["macd_hist"] / d["atr"].replace(0, np.nan)
    d["atr_ratio"]       = d["atr"] / d["atr_mean20"]
    d["zscore_20"]       = compute_zscore(d["close"], window=20)
    d["delta_norm"]      = d["delta"] / d["volume"].replace(0, np.nan)
    d["cum_delta_slope"] = d["cumulative_delta"].diff(5)
    d["vol_ratio"]       = d["volume"] / d["volume"].rolling(20).mean()

    # Daily-bar context features
    if df_daily is not None and not df_daily.empty:
        try:
            d = _add_daily_features(d, df_daily)
        except Exception:
            for col in _DAILY_FEATURE_COLS:
                d[col] = 0.0
    else:
        for col in _DAILY_FEATURE_COLS:
            d[col] = 0.0

    # Regime features
    d = _add_regime_features(d, regime)

    # Target: did price rise by 0.5 * ATR within the next 3 bars?
    d["future_return"] = d["close"].shift(-3) - d["close"]
    d["target"]        = (d["future_return"] > 0.5 * d["atr"]).astype(int)

    return d[FEATURE_COLS + ["target"]].dropna()
