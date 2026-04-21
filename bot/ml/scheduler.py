"""Weekly ML model retraining scheduler."""
import asyncio
import logging
import schedule
import time
import threading
import os
import asyncpg
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ib_insync import IB

log = logging.getLogger(__name__)


async def retrain_all(ib):
    """Download latest data and retrain LightGBM for all instruments."""
    from ibkr.data_downloader import download_ibkr_history, download_yfinance_history, merge_and_save
    from ml.trainer import train_model
    from config import INSTRUMENTS

    for instrument in INSTRUMENTS:
        try:
            log.info(f"Retraining ML model for {instrument}...")
            ibkr_df = await download_ibkr_history(ib, instrument)
            yf_df = download_yfinance_history(instrument)
            combined = merge_and_save(instrument, ibkr_df, yf_df)
            metrics = train_model(instrument, combined)

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
