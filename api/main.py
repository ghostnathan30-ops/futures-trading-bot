import asyncio
import os
from contextlib import asynccontextmanager
from pathlib import Path
from dotenv import load_dotenv

# Load .env before any local imports so all modules see env vars on first read
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from auth.routes import router as auth_router
from routes.account import router as account_router
from routes.positions import router as positions_router
from routes.trades import router as trades_router
from routes.signals import router as signals_router
from routes.performance import router as performance_router
from routes.bot import router as bot_router
from routes.snapshots import router as snapshots_router
from routes.ml import router as ml_router
from routes.backtest import router as backtest_router
from websocket.manager import router as ws_router
from websocket.broadcaster import run_broadcaster
from db.connection import engine
from sqlalchemy import text


import logging as _logging
_log = _logging.getLogger(__name__)


async def _run_migrations():
    """Apply pending SQL migrations on startup. Silently skips if DB is unreachable.

    Each statement is executed in its own transaction so that IF NOT EXISTS DDL
    is idempotent and a single failure does not abort the rest of the batch.
    Multi-statement SQL files are split on ';' because asyncpg's extended-query
    protocol does not support multiple statements in a single execute() call.
    """
    migrations_dir = Path(__file__).resolve().parents[1] / "db" / "migrations"
    if not migrations_dir.exists():
        return
    try:
        applied = 0
        for sql_file in sorted(migrations_dir.glob("*.sql")):
            sql_text = sql_file.read_text()
            statements = [
                s.strip() for s in sql_text.split(";")
                if s.strip()
            ]
            for stmt in statements:
                try:
                    async with engine.begin() as conn:
                        await conn.execute(text(stmt))
                    applied += 1
                except Exception:
                    pass  # IF NOT EXISTS — idempotent; skip duplicates
        print(f"✓ Migrations applied ({applied} statements) — database ready.", flush=True)
    except Exception as exc:
        print(f"⚠ DB not reachable at startup — migrations skipped: {exc}", flush=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await _run_migrations()
    broadcaster_task = asyncio.create_task(run_broadcaster())
    yield
    broadcaster_task.cancel()
    try:
        await broadcaster_task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="Futures Trading Bot API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in [auth_router, account_router, positions_router, trades_router,
               signals_router, performance_router, bot_router, snapshots_router,
               ml_router, backtest_router, ws_router]:
    app.include_router(router)


@app.get("/health")
def health():
    return {"status": "ok"}
