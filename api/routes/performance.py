from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from db.connection import get_db
from auth.routes import require_auth
import math

router = APIRouter(prefix="/performance", tags=["performance"])


@router.get("")
async def get_performance(db: AsyncSession = Depends(get_db), _=Depends(require_auth)):
    result = await db.execute(text("""
        SELECT
            COUNT(*) AS total_trades,
            SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) AS wins,
            SUM(CASE WHEN pnl <= 0 THEN 1 ELSE 0 END) AS losses,
            ROUND(AVG(CASE WHEN pnl > 0 THEN pnl END)::numeric, 2) AS avg_win,
            ROUND(ABS(AVG(CASE WHEN pnl <= 0 THEN pnl END))::numeric, 2) AS avg_loss,
            ROUND(SUM(pnl)::numeric, 2) AS total_pnl,
            ROUND(AVG(ml_confidence)::numeric, 4) AS avg_ml_confidence
        FROM trades
    """))
    row = dict(result.mappings().first())
    wins = row["wins"] or 0
    total = row["total_trades"] or 1
    row["win_rate"] = round(wins / total, 4)

    avg_win = float(row["avg_win"] or 0)
    avg_loss = float(row["avg_loss"] or 1)
    row["profit_factor"] = round(avg_win / avg_loss, 3) if avg_loss else 0

    snaps = await db.execute(text("""
        SELECT date, net_pnl FROM performance_daily ORDER BY date
    """))
    daily_pnls = [float(r["net_pnl"] or 0) for r in snaps.mappings().all()]
    if len(daily_pnls) > 1:
        import statistics
        mean = statistics.mean(daily_pnls)
        std = statistics.stdev(daily_pnls) or 1
        row["sharpe"] = round((mean / std) * math.sqrt(252), 3)
    else:
        row["sharpe"] = 0.0

    return row
