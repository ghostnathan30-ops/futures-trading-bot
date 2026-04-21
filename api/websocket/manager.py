import asyncio
import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from auth.jwt import decode_token

router = APIRouter()
log = logging.getLogger(__name__)

_connections: list[WebSocket] = []


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket, token: str = ""):
    payload = decode_token(token)
    if not payload:
        await ws.close(code=4001)
        return

    await ws.accept()
    _connections.append(ws)
    log.info(f"WebSocket connected. Total: {len(_connections)}")
    try:
        while True:
            await ws.receive_text()
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        if ws in _connections:
            _connections.remove(ws)
        log.info(f"WebSocket disconnected. Total: {len(_connections)}")


async def broadcast(event: str, data: dict):
    """Broadcast event to all connected dashboard clients."""
    message = json.dumps({"event": event, "data": data})
    dead = []
    for ws in _connections:
        try:
            await ws.send_text(message)
        except Exception:
            dead.append(ws)
    for ws in dead:
        _connections.remove(ws)
