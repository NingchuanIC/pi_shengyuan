"""BigTrader signal strategy template; dense daily data preserves helper risk checks."""

import pandas as pd
from bigquant import bigtrader, dai

START_DATE = "2024-01-01"
END_DATE = "2025-03-07"
CAPITAL = 1000000
MAX_HOLD_DAYS = 5
TAKE_PROFIT = 0.08
STOP_LOSS = 0.05


def initialize(context: bigtrader.IContext):
    context.set_commission(bigtrader.PerOrder(buy_cost=0.0003, sell_cost=0.0013, min_cost=5))
    sql = """
    SELECT
        date,
        instrument,
        m_ta_rsi(close, 14) AS rsi,
        CASE
            WHEN st_status = 0 AND suspended = 0 AND rsi < 20 THEN 1
            WHEN rsi > 70 THEN -1
            ELSE 0
        END AS signal,
        0.1 AS weight
    FROM cn_stock_prefactors
    ORDER BY date, instrument
    """
    df = dai.query(
        sql,
        filters={"date": [context.add_trading_days(context.start_date, -60), context.end_date]},
    ).df()
    context.data = df.loc[pd.to_datetime(df["date"]) >= pd.Timestamp(context.start_date)].copy()
    # Do not filter to signal=1 rows or rebalance dates: the helper checks exits on each populated day.


def handle_data(context: bigtrader.IContext, data: bigtrader.IBarData):
    return bigtrader.HandleDataLib.handle_data_signal_based(
        context,
        data,
        max_hold_days=MAX_HOLD_DAYS,
        take_profit=TAKE_PROFIT,
        stop_loss=STOP_LOSS,
        max_open_weights_per_day=0.2,
    )


def main():
    performance = bigtrader.run(
        market=bigtrader.Market.CN_STOCK,
        frequency=bigtrader.Frequency.DAILY,
        start_date=START_DATE,
        end_date=END_DATE,
        capital_base=CAPITAL,
        initialize=initialize,
        handle_data=handle_data,
        benchmark="000300.SH",
    )
    performance.render()


if __name__ == "__main__":
    main()
