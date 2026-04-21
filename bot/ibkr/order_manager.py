import logging
from datetime import datetime, timezone
from ib_insync import IB, Trade
from ibkr.market_data import get_contract, CONTRACT_MONTHS
from db.writer import write_trade

log = logging.getLogger(__name__)

# Track open positions by instrument so we can match fills on exit
_open_positions: dict[str, dict] = {}


async def place_bracket_order(
    ib: IB,
    instrument: str,
    quantity: int,
    action: str,        # BUY or SELL
    entry_price: float,
    stop_loss: float,
    take_profit: float,
    trade_meta: dict | None = None,
) -> list:
    """Place a bracket order (entry + stop + target) on IBKR.

    trade_meta may contain: ml_confidence, regime_state, delta_at_entry,
    vwap_at_entry, atr_at_entry, kelly_fraction — stored for trade logging.
    """
    contract = get_contract(instrument)
    await ib.qualifyContractsAsync(contract)

    bracket = ib.bracketOrder(
        action=action,
        quantity=quantity,
        limitPrice=round(entry_price, 2),
        takeProfitPrice=round(take_profit, 2),
        stopLossPrice=round(stop_loss, 2),
    )

    trades = []
    parent_trade = None
    for order in bracket:
        trade = ib.placeOrder(contract, order)
        trades.append(trade)
        log.info(f"Placed {order.orderType} {action} {quantity} {instrument} "
                 f"@ {getattr(order, 'lmtPrice', None) or getattr(order, 'auxPrice', None)}")
        if order.orderType == "LMT":
            parent_trade = trade

    # Register fill callbacks on the child (stop/target) orders
    if parent_trade is not None:
        meta = trade_meta or {}
        _open_positions[instrument] = {
            "entry_price": entry_price,
            "entry_ts": datetime.now(timezone.utc),
            "side": action,
            "quantity": quantity,
            "contract": CONTRACT_MONTHS.get(instrument, ""),
            **meta,
        }
        for trade in trades[1:]:   # child orders = stop & target
            trade.filledEvent += _make_fill_handler(instrument, trade)

    return trades


def _make_fill_handler(instrument: str, trade: Trade):
    """Return a callback that fires when a child (stop or target) order fills."""
    async def _on_fill(trade: Trade, fill):
        pos = _open_positions.pop(instrument, None)
        if pos is None:
            return
        exit_price = fill.execution.avgPrice
        point_value = {"ES": 50.0, "NQ": 20.0, "GC": 100.0}.get(instrument, 1.0)
        direction = 1 if pos["side"] == "BUY" else -1
        pnl = (exit_price - pos["entry_price"]) * direction * pos["quantity"] * point_value
        commission = fill.commissionReport.commission if fill.commissionReport else 0

        exit_reason = "stop_loss" if trade.order.orderType == "STP" else "take_profit"
        log.info(f"Fill: {instrument} {exit_reason} @ {exit_price:.2f}  P&L={pnl:.2f}")

        await write_trade({
            "instrument":    instrument,
            "contract":      pos["contract"],
            "side":          pos["side"],
            "quantity":      pos["quantity"],
            "entry_price":   pos["entry_price"],
            "exit_price":    exit_price,
            "entry_ts":      pos["entry_ts"],
            "exit_ts":       datetime.now(timezone.utc),
            "pnl":           pnl,
            "commission":    commission,
            "exit_reason":   exit_reason,
            "ml_confidence": pos.get("ml_confidence"),
            "regime_state":  pos.get("regime_state"),
            "delta_at_entry":pos.get("delta_at_entry"),
            "vwap_at_entry": pos.get("vwap_at_entry"),
            "atr_at_entry":  pos.get("atr_at_entry"),
            "kelly_fraction":pos.get("kelly_fraction"),
        })
    return _on_fill


async def cancel_all_orders(ib: IB, instrument: str):
    """Cancel all open orders for an instrument."""
    open_trades = [t for t in ib.openTrades()
                   if t.contract.symbol == instrument]
    for trade in open_trades:
        ib.cancelOrder(trade.order)
        log.info(f"Cancelled order {trade.order.orderId} for {instrument}")
