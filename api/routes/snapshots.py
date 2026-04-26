from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from db.connection import get_db
from auth.routes import require_auth

router = APIRouter(prefix="/snapshots", tags=["snapshots"])


@router.get("")
async def get_snapshots(
    hours: int = Query(24, le=720),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    result = await db.execute(
        text("""SELECT ts, net_liq FROM account_snapshots
                WHERE ts > NOW() - MAKE_INTERVAL(hours => :hours)
                ORDER BY ts"""),
        {"hours": hours},
    )
    return [dict(r) for r in result.mappings().all()]
