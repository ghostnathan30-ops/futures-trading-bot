from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from auth.security import verify_password, get_admin_hash, get_admin_username
from auth.jwt import create_access_token, create_refresh_token, decode_token

router = APIRouter(prefix="/auth", tags=["auth"])
bearer = HTTPBearer()


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(req: LoginRequest):
    if req.username != get_admin_username():
        raise HTTPException(status_code=401, detail="Invalid credentials")
    try:
        admin_hash = get_admin_hash()
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    if not verify_password(req.password, admin_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {
        "access_token": create_access_token(req.username),
        "refresh_token": create_refresh_token(req.username),
        "token_type": "bearer",
    }


@router.post("/refresh")
def refresh(creds: HTTPAuthorizationCredentials = Depends(bearer)):
    payload = decode_token(creds.credentials)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    username = payload["sub"]
    return {"access_token": create_access_token(username), "token_type": "bearer"}


def require_auth(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> str:
    payload = decode_token(creds.credentials)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token")
    return payload["sub"]
