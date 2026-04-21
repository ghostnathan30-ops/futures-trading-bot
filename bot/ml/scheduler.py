"""Weekly ML model retraining scheduler."""
import asyncio
import logging
import os
import shutil
import schedule
import time
import threading
import asyncpg
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ib_insync import IB

log = logging.getLogger(__name__)


async def retrain_all(ib):
    """Download latest data from all sources and retrain LightGBM for all instruments.

    Data sources (all independent / gracefully optional):
      1. IBKR 15m — recent 60 days, highest accuracy
      2. yfinance 1h — 2 years hourly
      3. yfinance daily — 20+ years daily (trend context)
      4. Nasdaq Data Link daily — 25-50 years daily (requires NASDAQ_API_KEY)

    Model versioning: backs up current model before overwrite.
    """
    from ibkr.data_downloader import (
        download_ibkr_history,
        download_yfinance_history,
        download_yfinance_daily,
        download_nasdaq_daily,
        merge_and_save,
    )
    from ml.trainer import train_model
    from config import INSTRUMENTS, MODEL_DIR

    for instrument in INSTRUMENTS:
        try:
            log.info(f"Retraining ML model for {instrument}...")

            # Download all data sources
            ibkr_df    = await download_ibkr_history(ib, instrument)
            yf_df      = download_yfinance_history(instrument)
            yf_daily   = download_yfinance_daily(instrument)
            nasdaq_df  = download_nasdaq_daily(instrument)

            combined = merge_and_save(
                instrument, ibkr_df, yf_df,
                yf_daily_df=yf_daily, nasdaq_df=nasdaq_df,
            )
            if combined.empty:
                log.warning(f"No training data for {instrument} — skipping retraining")
                continue

            # Back up existing model before overwriting
            old_path    = os.path.join(MODEL_DIR, f"{instrument}_lgbm.pkl")
            backup_path = os.path.join(MODEL_DIR, f"{instrument}_lgbm_backup.pkl")
            if os.path.exists(old_path):
                shutil.copy2(old_path, backup_path)
                log.info(f"Backed up previous model for {instrument}")

            # Load daily parquet for feature engineering (written by merge_and_save)
            daily_path = os.path.join(MODEL_DIR, f"{instrument}_daily.parquet")
            import pandas as pd
            df_daily = pd.read_parquet(daily_path) if os.path.exists(daily_path) else None

            metrics = train_model(instrument, combined, df_daily=df_daily)

            # Persist metrics to DB
            pool = await asyncpg.create_pool(
                host=os.getenv("POSTGRES_HOST"),
                port=int(os.getenv("POSTGRES_PORT", 5432)),
                database=os.getenv("POSTGRES_DB"),
                user=os.getenv("POSTGRES_USER"),
                password=os.getenv("POSTGRES_PASSWORD"),
            )
            async with pool.acquire() as conn:
                await conn.execute("""
                    INSERT INTO ml_models
                      (instrument, accuracy, precision_score, recall_score,
                       f1_score, n_features, n_samples, model_path)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                """,
                instrument, metrics["accuracy"], metrics["precision"],
                metrics["recall"], metrics["f1"], metrics["n_features"],
                metrics["n_samples"], metrics["model_path"])
            await pool.close()

            log.info(f"ML model for {instrument} retrained. Accuracy: {metrics['accuracy']:.3f}")

        except Exception as e:
            log.error(f"Retraining failed for {instrument}: {e}", exc_info=True)


def start_scheduler(ib):
    """Start weekly retraining scheduler in background thread.

    Uses run_coroutine_threadsafe() to submit retrain_all() onto the main
    event loop, so all ib_insync calls stay on the correct loop.
    """
    loop = asyncio.get_running_loop()  # capture the main event loop

    def run_retrain():
        try:
            future = asyncio.run_coroutine_threadsafe(retrain_all(ib), loop)
            future.result(timeout=3600)  # blocks scheduler thread up to 1 hour
        except Exception as e:
            log.error(f"Scheduled retraining failed: {e}", exc_info=True)

    schedule.every().sunday.at("23:00").do(run_retrain)

    def scheduler_loop():
        while True:
            schedule.run_pending()
            time.sleep(60)

    t = threading.Thread(target=scheduler_loop, daemon=True)
    t.start()
    log.info("ML retraining scheduler started (weekly, Sunday 23:00)")
