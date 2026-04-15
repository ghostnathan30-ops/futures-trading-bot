from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from db.connection import get_db
from auth.routes import require_auth

router = APIRouter(prefix="/account", tags=["account"])


@router.get("")
async def get_account(db: AsyncSession = Depends(get_db), _=Depends(require_auth)):
    result = await db.execute(
        text("SELECT * FROM account_snapshots ORDER BY ts DESC LIMIT 1")
    )
    row = result.mappings().first()
    return dict(row) if row else {}
