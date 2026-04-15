import numpy as np
import pandas as pd
import joblib
from hmmlearn.hmm import GaussianHMM

class RegimeDetector:
    STATE_LABELS = ["ranging", "trending", "volatile"]

    def __init__(self, n_states: int = 3):
        self.n_states = n_states
        self.model = GaussianHMM(n_components=n_states, covariance_type="diag", n_iter=1000, random_state=42)
        self._state_map: dict = {}
        self._fitted = False

    def _features(self, df: pd.DataFrame) -> np.ndarray:
        returns = df["close"].pct_change().fillna(0)
        vol = returns.rolling(20).std().fillna(returns.std())
        momentum = returns.rolling(10).mean().fillna(0)
        return np.column_stack([returns, vol, momentum])

    def fit(self, df: pd.DataFrame) -> "RegimeDetector":
        X = self._features(df)
        self.model.fit(X)
        self._fitted = True
        self._map_states(df)
        return self

    def _map_states(self, df: pd.DataFrame):
        X = self._features(df)
        states = self.model.predict(X)
        returns = df["close"].pct_change().fillna(0)
        vols = {s: returns[states == s].std() for s in range(self.n_states)}
        sorted_states = sorted(vols, key=lambda s: vols[s])
        self._state_map = {sorted_states[0]: "ranging", sorted_states[1]: "trending", sorted_states[2]: "volatile"}

    def predict(self, df: pd.DataFrame) -> str:
        if not self._fitted:
            raise RuntimeError("Must fit before predicting")
        X = self._features(df)
        state_idx = self.model.predict(X)[-1]
        return self._state_map.get(state_idx, "ranging")

    def save(self, path: str):
        joblib.dump({"model": self.model, "state_map": self._state_map}, path)

    @classmethod
    def load(cls, path: str) -> "RegimeDetector":
        data = joblib.load(path)
        d = cls()
        d.model = data["model"]
        d._state_map = data["state_map"]
        d._fitted = True
        return d
