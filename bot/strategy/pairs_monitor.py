import pandas as pd
import numpy as np

class PairsMonitor:
    def __init__(self, window: int = 60, threshold: float = 2.0):
        self.window = window
        self.threshold = threshold

    def _normalized_spread(self, es: pd.Series, nq: pd.Series) -> pd.Series:
        es_ret = es.pct_change().fillna(0)
        nq_ret = nq.pct_change().fillna(0)
        spread = es_ret - nq_ret
        mean = spread.rolling(self.window).mean()
        std  = spread.rolling(self.window).std().replace(0, np.nan)
        return (spread - mean) / std

    def evaluate(self, es: pd.Series, nq: pd.Series) -> str:
        zscore = self._normalized_spread(es, nq).iloc[-1]
        if pd.isna(zscore):
            return "neutral"
        if zscore > self.threshold:
            return "long_nq_short_es"
        if zscore < -self.threshold:
            return "long_es_short_nq"
        return "neutral"

    def correlation(self, es: pd.Series, nq: pd.Series) -> float:
        return es.pct_change().corr(nq.pct_change())
