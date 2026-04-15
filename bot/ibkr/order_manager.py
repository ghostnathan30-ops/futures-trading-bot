import logging
from ib_insync import IB
from ibkr.market_data import get_contract

log = logging.getLogger(__name__)


async def place_bracket_order(
    ib: IB,
    instrument: str,
    quantity: int,
    action: str,        # BUY or SELL
    entry_price: float,
    stop_loss: float,
    take_profit: float,
) -> list:
    """Place a bracket order (entry + stop + target) on IBKR."""
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
    for order in bracket:
        trade = ib.placeOrder(contract, order)
        trades.append(trade)
        log.info(f"Placed {order.orderType} {action} {quantity} {instrument} "
                 f"@ {getattr(order, 'lmtPrice', None) or getattr(order, 'auxPrice', None)}")

    return trades


async def cancel_all_orders(ib: IB, instrument: str):
    """Cancel all open orders for an instrument."""
    open_trades = [t for t in ib.openTrades()
                   if t.contract.symbol == instrument]
    for trade in open_trades:
        ib.cancelOrder(trade.order)
        log.info(f"Cancelled order {trade.order.orderId} for {instrument}")
