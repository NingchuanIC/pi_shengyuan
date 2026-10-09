"""QMT index allocation template. order_shares and account queries are injected by QMT."""

ACCOUNT_ID = ""  # Set a QMT account ID before using this code in the platform.
CAPITAL_RATIO = 0.8
REBALANCE_BARS = 20


def init(ContextInfo):
    if not ACCOUNT_ID:
        raise ValueError("Configure ACCOUNT_ID in QMT")
    ContextInfo.accountid = ACCOUNT_ID
    ContextInfo.universe = sorted(ContextInfo.get_stock_list_in_sector("沪深300"))
    ContextInfo.set_universe(ContextInfo.universe)
    ContextInfo.last_rebalance_bar = None


def handlebar(ContextInfo):
    bar = ContextInfo.barpos
    if bar < 1 or bar % REBALANCE_BARS != 0 or ContextInfo.last_rebalance_bar == bar:
        return
    prices = ContextInfo.get_history_data(2, "1d", "close", 3)
    positions = get_trade_detail_data(ContextInfo.accountid, "STOCK", "POSITION")
    accounts = get_trade_detail_data(ContextInfo.accountid, "STOCK", "ACCOUNT")
    if not accounts:
        return
    holdings = {
        position.m_strInstrumentID + "." + position.m_strExchangeID: position.m_nVolume
        for position in positions
    }
    cash = accounts[0].m_dAvailable
    candidates = [
        stock for stock in ContextInfo.universe
        if stock in prices and len(prices[stock]) >= 2
        and prices[stock][-2] > 0 and not ContextInfo.is_suspended_stock(stock)
    ]
    if not candidates:
        return
    held_symbols = [stock for stock, shares in holdings.items() if shares > 0]
    # Do not undervalue holdings when required quotes are missing.
    if any(stock not in prices or len(prices[stock]) < 2 for stock in held_symbols):
        return
    equity = cash + sum(prices[stock][-2] * holdings[stock] for stock in held_symbols)
    value_per_stock = equity * CAPITAL_RATIO / len(candidates)
    targets = {stock: int(value_per_stock / prices[stock][-2] / 100) * 100 for stock in candidates}
    # Keep shares as shares; QMT's m_nVolume is not a number of lots.
    orders = []
    for stock in sorted(set(holdings) | set(targets)):
        delta = targets.get(stock, 0) - holdings.get(stock, 0)
        if delta and stock in prices and len(prices[stock]) >= 2:
            orders.append((stock, delta))
    # Submit sells first; a submitted order is not treated as a filled trade.
    for stock, delta in sorted(orders, key=lambda item: (item[1] >= 0, item[0])):
        if delta > 0:
            # Reserve a commission allowance rather than assuming sells immediately produce cash.
            delta = min(delta, int(cash / (prices[stock][-2] * 1.001) / 100) * 100)
            cash -= delta * prices[stock][-2] * 1.001
        if delta:
            order_shares(stock, delta, "fix", prices[stock][-2], ContextInfo, ContextInfo.accountid)
    ContextInfo.last_rebalance_bar = bar
