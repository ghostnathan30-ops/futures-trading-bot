"""
Backtest API routes.

POST /backtest/run          — trigger a new backtest (non-blocking subprocess)
GET  /backtest/runs         — list all runs (summary only)
GET  /backtest/runs/{id}    — full run details + equity curve
GET  /backtest/runs/{id}/trades — trade list for a run
"""
import os
import sys
import uuid
import subprocess
import tempfile
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel

from db.connection import get_db
from auth.routes import require_auth

router = APIRouter(prefix="/backtest", tags=["backtest"])

# Path to the bot/ directory — the subprocess runs python -m backtest.engine from there
_BOT_DIR = os.environ.get(
    "BOT_DIR",
    os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "bot")),
)

# Use the bot's own venv Python so it has yfinance, pandas, hmmlearn, etc.
# Falls back to BOT_PYTHON env var, then auto-detects, then sys.executable.
_BOT_PYTHON = os.environ.get(
    "BOT_PYTHON",
    os.path.join(_BOT_DIR, "venv", "bin", "python"),
)
if not os.path.isfile(_BOT_PYTHON):
    _BOT_PYTHON = sys.executable


class RunRequest(BaseModel):
    instrument:     str
    start_date:     str             # "YYYY-MM-DD"
    end_date:       str             # "YYYY-MM-DD"
    initial_equity: float = 100_000.0
    timeframe:      str   = "1h"   # "1h" = 2yr hourly | "1d" = 25yr daily


@router.post("/run")
async def start_backtest(
    req: RunRequest,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    """
    Insert a pending run record and immediately spawn the engine as a subprocess.
    Returns {run_id, status: "pending"} — the client should poll /runs/{run_id}.
    """
    run_id = str(uuid.uuid4())

    if req.timeframe not in ("1h", "1d"):
        raise HTTPException(status_code=422, detail="timeframe must be '1h' or '1d'")

    try:
        await db.execute(text("""
            INSERT INTO backtest_runs
              (run_id, instrument, start_date, end_date, initial_equity, status)
            VALUES (:run_id, :instrument, :start_date, :end_date, :initial_equity, 'pending')
        """), {
            "run_id":         run_id,
            "instrument":     req.instrument,
            "start_date":     date.fromisoformat(req.start_date),
            "end_date":       date.fromisoformat(req.end_date),
            "initial_equity": req.initial_equity,
        })
        await db.commit()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to create backtest run: {exc}")

    # Spawn subprocess — does NOT block the API worker.
    # Logs are written to /tmp/backtest_<run_id[:8]>.log for debugging.
    log_path = os.path.join(tempfile.gettempdir(), f"backtest_{run_id[:8]}.log")
    with open(log_path, "w") as log_fh:
        subprocess.Popen(
            [
                _BOT_PYTHON, "-m", "backtest.engine",
                "--run_id",         run_id,
                "--instrument",     req.instrument,
                "--start_date",     req.start_date,
                "--end_date",       req.end_date,
                "--initial_equity", str(req.initial_equity),
                "--timeframe",      req.timeframe,
            ],
            cwd=_BOT_DIR,
            env={**os.environ},
            stdout=log_fh,
            stderr=log_fh,
        )

    return {"run_id": run_id, "status": "pending"}


@router.get("/runs")
async def list_runs(
    instrument: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    where  = "WHERE instrument = :instrument" if instrument else ""
    params: dict = {"limit": limit}
    if instrument:
        params["instrument"] = instrument

    result = await db.execute(text(f"""
        SELECT run_id, instrument, start_date, end_date, initial_equity,
               final_equity, total_return, sharpe, sortino, max_drawdown,
               calmar, profit_factor, total_trades, wins, losses,
               win_rate, avg_win, avg_loss, expectancy, status, created_at
        FROM backtest_runs
        {where}
        ORDER BY created_at DESC
        LIMIT :limit
    """), params)
    return [dict(r) for r in result.mappings().all()]


@router.get("/runs/{run_id}")
async def get_run(
    run_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    """Returns full run metadata plus the equity curve array."""
    result = await db.execute(text("""
        SELECT * FROM backtest_runs WHERE run_id = :run_id
    """), {"run_id": run_id})
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Run not found")

    run    = dict(row)
    db_id  = run["id"]

    eq_result = await db.execute(text("""
        SELECT ts, equity FROM backtest_equity_curve
        WHERE backtest_run_id = :id
        ORDER BY ts
    """), {"id": db_id})
    run["equity_curve"] = [dict(r) for r in eq_result.mappings().all()]

    return run


@router.get("/runs/{run_id}/trades")
async def get_run_trades(
    run_id: str,
    limit: int = Query(1000, le=5000),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    id_result = await db.execute(text("""
        SELECT id FROM backtest_runs WHERE run_id = :run_id
    """), {"run_id": run_id})
    id_row = id_result.mappings().first()
    if not id_row:
        raise HTTPException(status_code=404, detail="Run not found")

    result = await db.execute(text("""
        SELECT * FROM backtest_trades
        WHERE backtest_run_id = :id
        ORDER BY entry_ts
        LIMIT :limit
    """), {"id": id_row["id"], "limit": limit})
    return [dict(r) for r in result.mappings().all()]
