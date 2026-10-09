---
name: bigquant-stock-strategy
description: 把股票策略思想转成 BigQuant DAI/BigTrader 完整 Python；默认股票策略生成器，区别于旧版可视化模块。
---

# StrategyCodeGenAgentV2

先梳理用户思路、参数、股票池、因子、方向、调仓、退出和风险约束。除用户要求拓展外遵循其思想，缺参数可作明确假设。读取 V2 的 BigTrader API、DAI 算子、数据表和最接近的完整策略示例。

默认 from bigquant import bigtrader, dai；优先 cn_stock_prefactors。initialize 批量查询、计算信号和权重，保存 context.data。权重策略复用 HandleDataLib.handle_data_weight_based；信号策略复用 handle_data_signal_based，提供退出信号或最大持有天数/止盈止损。只有确有交易状态需求时自定义 handle_data，不能把大规模数据计算移进每根 bar。

权重数据包含 date、instrument、weight；信号数据还包含 signal（1开仓，0不变，-1平仓）。查询日期 filters 预留历史窗口，SQL 显式 ORDER BY 日期、因子与 instrument，用 TradingDaysRebalance 等管理调仓。不要获取整个证券代码列表，也不要用 Python for loop 替代可向量化的因子计算。

参考的信号 helper 在无行或非调仓日可能提前返回；用户要求每天止损时，不得只依赖稀疏调仓数据触发风控。历史数据不能作为回测开始日前的真实下单信号。API 有未在接口段列出的 add_trading_days 等示例方法，按所选示例一致使用，不混搭不同 agent 版本。

原默认回测日期 2024-01-01—2025-03-07；用户给出日期则替换。输出策略逻辑概述、数据需求、指标/因子和 python 代码块中的 <bigquantStrategy name="十字以内策略名">完整代码</bigquantStrategy>。只写出 bigtrader.run 和 render 入口，不执行。权重和信号的纯源码模板见 assets/stock-weight.py、assets/stock-signal.py。

## 参考和工具

先读 [references/index.md](references/index.md)，按所需章节读取 [references/source.md](references/source.md)。共同约定见 [../../bigquant/common.md](../../bigquant/common.md)，冲突处理见 [../../bigquant/MIGRATION.md](../../bigquant/MIGRATION.md)。

安装了本项目 extension 时，quant_load_agent 可加载本流程和 JSON 上下文；quant_reference 按行读取原参考。直接使用 /skill:bigquant-stock-strategy 时，从用户提供的资料或 context JSON 获取任务数据。除非用户另行授权，仅生成代码，不执行策略或平台查询。
