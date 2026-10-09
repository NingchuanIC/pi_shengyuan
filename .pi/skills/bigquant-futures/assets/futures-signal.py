"""Daily futures signal template based on the provided futures examples."""

import pandas as pd
from bigquant import bigtrader, dai
from bigtrader.constant import Direction

START_DATE = "2024-01-01"
END_DATE = "2024-12-31"
CONTINUOUS_CONTRACT = "rb8888.SHF"
LOTS = 1


def initialize(context: bigtrader.IContext):
    sql = """
    SELECT
        date,
        instrument,
        dominant,
        m_avg(close, 5) AS fast,
        m_avg(close, 20) AS slow,
        CASE WHEN fast > slow THEN 1 WHEN fast < slow THEN -1 ELSE 0 END AS signal
    FROM cn_future_bar1d
    LEFT JOIN cn_future_dominant USING (date, instrument)
    WHERE instrument = $continuous_contract
    ORDER BY date, instrument
    """
    context.data = dai.query(
        sql,
        filters={"date": [context.add_trading_days(context.start_date, -60), context.end_date]},
        params={"continuous_contract": CONTINUOUS_CONTRACT},
    ).df()
    context.data["date"] = pd.to_datetime(context.data["date"]).dt.strftime("%Y-%m-%d")


def handle_data(context: bigtrader.IContext, data: bigtrader.IBarData):
    rows = context.data.loc[context.data["date"] == data.current_dt.strftime("%Y-%m-%d")]
    if rows.empty or pd.isna(rows.iloc[0]["dominant"]):
        return
    row = rows.iloc[0]
    if pd.isna(row["fast"]) or pd.isna(row["slow"]):
        return
    target = row["dominant"]
    signal = int(row["signal"])
    desired_long = LOTS if signal == 1 else 0
    desired_short = LOTS if signal == -1 else 0
    # Close old expiry contracts first. Re-evaluate on a later bar after fills are visible.
    old_symbols = [symbol for symbol in context.get_account_positions() if symbol != target]
    closed_old = False
    for symbol in old_symbols:
        long_qty = context.get_account_position(symbol, direction=Direction.LONG).avail_qty
        short_qty = context.get_account_position(symbol, direction=Direction.SHORT).avail_qty
        if long_qty:
            context.sell_close(symbol, long_qty)
            closed_old = True
        if short_qty:
            context.buy_close(symbol, short_qty)
            closed_old = True
    if closed_old:
        return
    long_qty = context.get_account_position(target, direction=Direction.LONG).avail_qty
    short_qty = context.get_account_position(target, direction=Direction.SHORT).avail_qty
    closing = False
    if long_qty > desired_long:
        context.sell_close(target, long_qty - desired_long)
        closing = True
    if short_qty > desired_short:
        context.buy_close(target, short_qty - desired_short)
        closing = True
    if closing:
        return
    if desired_long > long_qty:
        context.buy_open(target, desired_long - long_qty)
    if desired_short > short_qty:
        context.sell_open(target, desired_short - short_qty)


def main():
    performance = bigtrader.run(
        market=bigtrader.Market.CN_FUTURE,
        frequency=bigtrader.Frequency.DAILY,
        start_date=START_DATE,
        end_date=END_DATE,
        capital_base=1000000,
        initialize=initialize,
        handle_data=handle_data,
        order_price_field_buy="open",
        order_price_field_sell="open",
    )
    performance.render()


if __name__ == "__main__":
    main()
