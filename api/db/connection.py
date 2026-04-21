import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Load .env from project root (two levels up from api/)
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

# Use `or` fallbacks so empty-string env vars don't break the URL
DATABASE_URL = (
    f"postgresql+asyncpg://{os.getenv('POSTGRES_USER') or 'tradingbot'}:"
    f"{os.getenv('POSTGRES_PASSWORD') or 'changeme_secure_password'}@"
    f"{os.getenv('POSTGRES_HOST') or 'localhost'}:"
    f"{os.getenv('POSTGRES_PORT') or '5432'}/"
    f"{os.getenv('POSTGRES_DB') or 'tradingbot'}"
)

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
