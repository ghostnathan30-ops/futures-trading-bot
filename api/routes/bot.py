from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional
from db.connection import get_db
from auth.routes import require_auth

router = APIRouter(prefix="/bot", tags=["bot"])


class BotSettings(BaseModel):
    is_running: Optional[bool] = None
    kill_switch_on: Optional[bool] = None
    es_enabled: Optional[bool] = None
    nq_enabled: Optional[bool] = None
    gc_enabled: Optional[bool] = None
    risk_pct: Optional[float] = None
    daily_kill_pct: Optional[float] = None
    ml_enabled: Optional[bool] = None
    ml_min_confidence: Optional[float] = None


@router.get("")
async def get_bot_state(db: AsyncSession = Depends(get_db), _=Depends(require_auth)):
    result = await db.execute(text("SELECT * FROM bot_state WHERE id=1"))
    row = result.mappings().first()
    return dict(row) if row else {}


@router.post("")
async def update_bot_state(
    settings: BotSettings,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    updates = {k: v for k, v in settings.dict().items() if v is not None}
    if not updates:
        return {"ok": True}
    set_clause = ", ".join(f"{k}=:{k}" for k in updates)
    await db.execute(
        text(f"UPDATE bot_state SET {set_clause}, last_updated=NOW() WHERE id=1"),
        updates,
    )
    await db.commit()
    return {"ok": True}


@router.post("/kill")
async def kill_switch(db: AsyncSession = Depends(get_db), _=Depends(require_auth)):
    await db.execute(
        text("UPDATE bot_state SET kill_switch_on=TRUE, is_running=FALSE, last_updated=NOW() WHERE id=1")
    )
    await db.commit()
    return {"killed": True}
