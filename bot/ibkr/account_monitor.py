import logging
from ib_insync import IB

log = logging.getLogger(__name__)


async def get_account_values(ib: IB) -> dict:
    """Pull key account values from IBKR."""
    vals = {v.tag: v.value for v in ib.accountValues() if v.currency == "USD"}
    return {
        "net_liq":            float(vals.get("NetLiquidation", 0)),
        "cash_balance":       float(vals.get("CashBalance", 0)),
        "buying_power":       float(vals.get("BuyingPower", 0)),
        "excess_liq":         float(vals.get("ExcessLiquidity", 0)),
        "init_margin":        float(vals.get("InitMarginReq", 0)),
        "maint_margin":       float(vals.get("MaintMarginReq", 0)),
        "unrealized_pnl":     float(vals.get("UnrealizedPnL", 0)),
        "realized_pnl_today": float(vals.get("RealizedPnL", 0)),
    }
