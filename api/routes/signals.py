from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from db.connection import get_db
from auth.routes import require_auth

router = APIRouter(prefix="/signals", tags=["signals"])


@router.get("")
async def get_signals(
    limit: int = Query(50, le=500),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    result = await db.execute(
        text("SELECT * FROM signals ORDER BY ts DESC LIMIT :limit"), {"limit": limit}
    )
    return [dict(r) for r in result.mappings().all()]
