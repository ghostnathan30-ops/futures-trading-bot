import os
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError

ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_EXPIRE_HOURS = 24
REFRESH_EXPIRE_DAYS = 7


def _secret() -> str:
    """Read JWT_SECRET at call time so .env loaded in main.py is always used."""
    s = os.getenv("JWT_SECRET") or "insecure-dev-secret"
    if s == "insecure-dev-secret":
        import logging
        logging.getLogger(__name__).warning(
            "JWT_SECRET is not set — using insecure default. Set JWT_SECRET in your .env file."
        )
    return s


def create_access_token(username: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=ACCESS_EXPIRE_HOURS)
    return jwt.encode({"sub": username, "exp": exp, "type": "access"}, _secret(), ALGORITHM)


def create_refresh_token(username: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=REFRESH_EXPIRE_DAYS)
    return jwt.encode({"sub": username, "exp": exp, "type": "refresh"}, _secret(), ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, _secret(), algorithms=[ALGORITHM])
    except JWTError:
        return {}
