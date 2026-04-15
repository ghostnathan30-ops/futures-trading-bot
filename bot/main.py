import asyncio
import logging
from config import LOG_LEVEL
from strategy.engine import run_strategy_loop

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

if __name__ == "__main__":
    asyncio.run(run_strategy_loop())
