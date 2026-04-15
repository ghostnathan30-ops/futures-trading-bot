"""
Database writer stubs — full implementation in Task 22.
These async functions are called by the strategy engine to persist signals
and account snapshots. They are no-ops until the DB layer is wired up.
"""
import logging
from typing import Optional

log = logging.getLogger(__name__)


async def write_signal(instrument: str, result: dict, fired: bool, skip_reason: Optional[str]):
    """Persist a confluence signal evaluation to the database."""
    log.debug(
        f"write_signal: {instrument} fired={fired} score={result.get('score')} "
        f"skip={skip_reason}"
    )


async def write_account_snapshot(account: dict):
    """Persist an account snapshot to the database."""
    log.debug(f"write_account_snapshot: net_liq={account.get('net_liq')}")
