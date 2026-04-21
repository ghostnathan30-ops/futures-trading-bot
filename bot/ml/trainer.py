import os
import logging
import joblib
import pandas as pd
import numpy as np
import lightgbm as lgb
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
from ml.feature_engineering import build_features, FEATURE_COLS
from config import MODEL_DIR

log = logging.getLogger(__name__)

def train_model(instrument: str, df: pd.DataFrame) -> dict:
    log.info(f"Training ML model for {instrument} on {len(df)} rows")
    features_df = build_features(df)
    X = features_df[FEATURE_COLS]
    y = features_df["target"]
    tscv = TimeSeriesSplit(n_splits=5)
    fold_metrics = []
    model = lgb.LGBMClassifier(
        n_estimators=500, learning_rate=0.05, max_depth=6,
        num_leaves=31, min_child_samples=50, subsample=0.8,
        colsample_bytree=0.8, class_weight="balanced",
        random_state=42, verbose=-1,
    )
    for train_idx, val_idx in tscv.split(X):
        X_train, X_val = X.iloc[train_idx], X.iloc[val_idx]
        y_train, y_val = y.iloc[train_idx], y.iloc[val_idx]
        model.fit(X_train, y_train, eval_set=[(X_val, y_val)],
                  callbacks=[lgb.early_stopping(50, verbose=False)])
        preds = model.predict(X_val)
        fold_metrics.append({
            "accuracy": accuracy_score(y_val, preds),
            "precision": precision_score(y_val, preds, zero_division=0),
            "recall": recall_score(y_val, preds, zero_division=0),
            "f1": f1_score(y_val, preds, zero_division=0),
        })
    model.fit(X, y)
    os.makedirs(MODEL_DIR, exist_ok=True)
    path = os.path.join(MODEL_DIR, f"{instrument}_lgbm.pkl")
    joblib.dump(model, path)
    avg = {k: float(np.mean([m[k] for m in fold_metrics])) for k in fold_metrics[0]}
    return {**avg, "model_path": path, "n_features": len(FEATURE_COLS), "n_samples": len(X)}
