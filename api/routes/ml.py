from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from db.connection import get_db
from auth.routes import require_auth

router = APIRouter(prefix="/ml", tags=["ml"])


@router.get("/metrics")
async def get_ml_metrics(db: AsyncSession = Depends(get_db), _=Depends(require_auth)):
    result = await db.execute(
        text("SELECT * FROM ml_models ORDER BY trained_at DESC LIMIT 3")
    )
    return [dict(r) for r in result.mappings().all()]
