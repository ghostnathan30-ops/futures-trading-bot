import asyncio
import logging
from ib_insync import IB
from config import IBKR_HOST, IBKR_PORT, IBKR_CLIENT_ID

log = logging.getLogger(__name__)

_ib: IB = None


def get_ib() -> IB:
    return _ib


async def connect() -> IB:
    global _ib

    # Cleanly disconnect any existing connection before creating a new one
    if _ib is not None:
        try:
            _ib.disconnect()
        except Exception:
            pass

    _ib = IB()
    _ib.errorEvent += _on_error

    while True:
        try:
            await _ib.connectAsync(IBKR_HOST, IBKR_PORT, clientId=IBKR_CLIENT_ID)
            log.info(f"Connected to IBKR TWS at {IBKR_HOST}:{IBKR_PORT}")
            return _ib
        except Exception as e:
            log.warning(f"IBKR connection failed: {e}. Retrying in 10s...")
            await asyncio.sleep(10)


async def ensure_connected(ib: IB) -> IB:
    """Check connection health and reconnect if needed. Returns the (possibly new) IB instance."""
    global _ib
    if ib is None or not ib.isConnected():
        log.warning("IBKR disconnected — reconnecting...")
        return await connect()
    return ib


def _on_error(req_id, error_code, error_string, contract):
    if error_code in (2104, 2106, 2158):
        return  # Benign market data farm messages
    log.error(f"IBKR Error [{error_code}]: {error_string}")
