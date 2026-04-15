import asyncio
import logging
import os
from config import LOG_LEVEL, MODEL_DIR, INSTRUMENTS
from strategy.engine import run_strategy_loop
from ibkr.connection import connect
from ml.scheduler import start_scheduler, retrain_all

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


async def main():
    ib = await connect()

    # Train initial ML models if missing
    missing = [i for i in INSTRUMENTS
               if not os.path.exists(os.path.join(MODEL_DIR, f"{i}_lgbm.pkl"))]
    if missing:
        logging.getLogger(__name__).info(f"Training initial ML models for: {missing}")
        await retrain_all(ib)

    start_scheduler(ib)
    await run_strategy_loop()


if __name__ == "__main__":
    asyncio.run(main())
