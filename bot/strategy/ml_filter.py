import os
import joblib
import logging
import pandas as pd
from ml.feature_engineering import FEATURE_COLS, build_features
from config import MODEL_DIR, ML_MIN_CONFIDENCE, ML_CONFIDENCE_THRESHOLDS

log = logging.getLogger(__name__)

_models: dict = {}


def load_model(instrument: str):
    path = os.path.join(MODEL_DIR, f"{instrument}_lgbm.pkl")
    if os.path.exists(path):
        _models[instrument] = joblib.load(path)
        log.info(f"Loaded ML model for {instrument}")
    else:
        log.warning(f"No ML model found for {instrument} at {path}")


def ml_confidence(
    instrument: str,
    df: pd.DataFrame,
    df_daily: pd.DataFrame = None,
    regime: str = "trending",
) -> float:
    """Return model's confidence (0–1) that current bar is a winning setup.

    Args:
        instrument: ES, NQ, or GC.
        df: Recent intraday bars (15m).
        df_daily: Optional daily bars for daily-context features.
        regime: Current regime label from HMM detector.

    Returns:
        Probability of class 1 (winner). Returns 1.0 on error (fail-open).
    """
    if instrument not in _models:
        load_model(instrument)
    if instrument not in _models:
        return 1.0  # No model → don't block signals

    try:
        features_df = build_features(df, df_daily=df_daily, regime=regime)
        if features_df.empty:
            return 1.0
        X = features_df[FEATURE_COLS].iloc[[-1]]
        proba = _models[instrument].predict_proba(X)[0]
        confidence = float(proba[1])  # P(class=1 = winner)
        return confidence
    except Exception as e:
        log.error(f"ML inference error for {instrument}: {e}")
        return 1.0  # Fail open — don't block on errors


def ml_approved(
    instrument: str,
    df: pd.DataFrame,
    df_daily: pd.DataFrame = None,
    regime: str = "trending",
) -> bool:
    """Return True if ML confidence meets per-instrument threshold."""
    threshold = ML_CONFIDENCE_THRESHOLDS.get(instrument, ML_MIN_CONFIDENCE)
    confidence = ml_confidence(instrument, df, df_daily=df_daily, regime=regime)
    approved = confidence >= threshold
    log.debug(f"ML filter {instrument}: confidence={confidence:.3f} "
              f"threshold={threshold:.3f} approved={approved}")
    return approved
