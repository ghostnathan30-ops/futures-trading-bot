from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from db.connection import get_db
from auth.routes import require_auth

router = APIRouter(prefix="/positions", tags=["positions"])


@router.get("")
async def get_positions(db: AsyncSession = Depends(get_db), _=Depends(require_auth)):
    result = await db.execute(
        text("SELECT * FROM positions WHERE status='OPEN' ORDER BY entry_ts DESC")
    )
    return [dict(r) for r in result.mappings().all()]
