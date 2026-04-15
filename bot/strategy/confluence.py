import pandas as pd
import logging
from strategy.indicators import compute_indicators
from strategy.vwap import compute_vwap
from strategy.order_flow import compute_order_flow
from strategy.regime_hmm import RegimeDetector
from strategy.zscore import zscore_signal
from strategy.ml_filter import ml_approved
from config import CONFLUENCE_THRESHOLD

log = logging.getLogger(__name__)


def score_confluence(
    df_15m: pd.DataFrame,
    df_1h: pd.DataFrame,
    df_4h: pd.DataFrame,
    instrument: str,
    regime_detector: RegimeDetector,
) -> dict:
    """Score multi-timeframe confluence. Returns score dict with direction."""

    d4 = compute_indicators(df_4h)
    d1 = compute_indicators(df_1h)
    d15 = compute_indicators(df_15m)
    d15 = compute_vwap(d15)
    d15 = compute_order_flow(d15)

    r4 = d4.iloc[-1]
    r1 = d1.iloc[-1]
    r15 = d15.iloc[-1]

    score = 0
    reasons = []

    # 1. 4H trend: price above EMA50 and MACD positive
    if r4["close"] > r4["ema50"] and r4["macd_hist"] > 0:
        score += 1
        reasons.append("4H trend bullish")

    # 2. 1H: EMA20 > EMA50 and RSI 40-70
    if r1["ema20"] > r1["ema50"] and 40 < r1["rsi"] < 70:
        score += 1
        reasons.append("1H momentum ok")

    # 3. 15m: MACD bullish crossover
    if r15["macd_hist"] > 0 and d15["macd_hist"].iloc[-2] <= 0:
        score += 1
        reasons.append("15m MACD crossover")

    # 4. Price above VWAP
    if r15["close"] > r15["vwap"]:
        score += 1
        reasons.append("above VWAP")

    # 5. Cumulative delta positive
    if r15["cumulative_delta"] > 0:
        score += 1
        reasons.append("delta positive")

    # 6. Z-score not extended (not at ±2σ from VWAP)
    if abs(r15.get("price_vs_vwap", 0)) < 2.0:
        score += 1
        reasons.append("not extended vs VWAP")

    # Regime must be trending (hard gate — not scored)
    regime = regime_detector.predict(df_4h) if regime_detector._fitted else "trending"

    return {
        "score": score,
        "direction": "long",
        "regime": regime,
        "reasons": reasons,
        "ema_signal": score >= 1,
        "macd_signal": score >= 2,
        "rsi_signal": r15.get("rsi", 50) < 70,
        "vwap_signal": r15["close"] > r15["vwap"],
        "delta_signal": r15["cumulative_delta"] > 0,
        "atr": r15["atr"],
        "close": r15["close"],
        "vwap": r15["vwap"],
        "delta": r15["cumulative_delta"],
    }
