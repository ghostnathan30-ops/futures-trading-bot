from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from db.connection import get_db
from auth.routes import require_auth

router = APIRouter(prefix="/trades", tags=["trades"])


@router.get("")
async def get_trades(
    instrument: str = Query(None),
    limit: int = Query(100, le=1000),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    where = "WHERE instrument = :instrument" if instrument else ""
    params = {"limit": limit, "offset": offset}
    if instrument:
        params["instrument"] = instrument
    result = await db.execute(
        text(f"SELECT * FROM trades {where} ORDER BY entry_ts DESC LIMIT :limit OFFSET :offset"),
        params,
    )
    return [dict(r) for r in result.mappings().all()]
