import os
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError

SECRET = os.getenv("JWT_SECRET", "insecure-dev-secret")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_EXPIRE_HOURS = 24
REFRESH_EXPIRE_DAYS = 7


def create_access_token(username: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=ACCESS_EXPIRE_HOURS)
    return jwt.encode({"sub": username, "exp": exp, "type": "access"}, SECRET, ALGORITHM)


def create_refresh_token(username: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=REFRESH_EXPIRE_DAYS)
    return jwt.encode({"sub": username, "exp": exp, "type": "refresh"}, SECRET, ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET, algorithms=[ALGORITHM])
    except JWTError:
        return {}
