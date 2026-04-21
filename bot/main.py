import asyncio
import logging
import os
import time
from config import LOG_LEVEL, MODEL_DIR, INSTRUMENTS
from strategy.engine import run_strategy_loop
from ibkr.connection import connect
from ml.scheduler import start_scheduler, retrain_all

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

_log = logging.getLogger(__name__)
MAX_RESTART_DELAY = 300  # cap backoff at 5 minutes


async def main():
    ib = await connect()

    # Train initial ML models if missing — non-fatal if training fails
    missing = [i for i in INSTRUMENTS
               if not os.path.exists(os.path.join(MODEL_DIR, f"{i}_lgbm.pkl"))]
    if missing:
        _log.info(f"Training initial ML models for: {missing}")
        try:
            await retrain_all(ib)
        except Exception as e:
            _log.error(f"Initial ML training failed (non-fatal): {e}", exc_info=True)

    start_scheduler(ib)
    await run_strategy_loop(ib)


if __name__ == "__main__":
    attempt = 0
    while True:
        try:
            asyncio.run(main())
        except KeyboardInterrupt:
            _log.info("Shutdown requested — exiting.")
            break
        except Exception as e:
            attempt += 1
            delay = min(30 * attempt, MAX_RESTART_DELAY)
            _log.error(
                f"Bot crashed (attempt {attempt}): {e}. Restarting in {delay}s.",
                exc_info=True,
            )
            time.sleep(delay)
