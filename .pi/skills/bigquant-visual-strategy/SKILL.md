---
name: bigquant-visual-strategy
description: 生成 BigQuant 可视化模块策略代码；适用于明确需要 M.xxx.vN 模块图的请求，普通 Python 策略用 V2。
---

# StrategyCodeGenAgent

先从 examples_s 或用户消息获取完整可视化模板。没有模板时说明缺项，不假造默认选股配置。保持模板未被用户修改的条件、函数和参数；额外筛选条件在原基础上追加。

读取模块概览和因子清单。from bigmodule import M；图代码用 # <aistudiograph> / # </aistudiograph>；模块调用前用 # @module(comment=...)，按源版本 input_features_dai.v30、score_to_position.v4、extract_data_dai.v20、bigtrader.v43、stockranker.v9。未明确版本的模块以注入模板为准，不能杜撰 v1。

expr 每个因子一行，不换行拆公式，不加行尾逗号/AND；expr_filters 所有条件在同一行，用 AND/OR 连接，行尾不加连接词，SQL 注释用 --。expr_tables 保持 cn_stock_prefactors。score_field 只写字段排序，不计算，除用户要求升序外用 DESC；position_expr 必要时带表名。基础股票池各列表不得为空，提取数据的开始/结束日期必填，历史窗口充分向前预取。

止盈止损每天检查，不只调仓日检查；量纲不一致的因子组合先排名/标准化。落实每个用户需求，不能虚构字段或函数。

输出自然段说明及 <bigquantStrategy name="十字以内策略名">完整模块代码</bigquantStrategy>；禁止 Markdown 代码块。名称需符合本策略含义。原文的“最新版本”只指提供的版本快照，不代表已联网确认。

## 参考和工具

先读 [references/index.md](references/index.md)，按所需章节读取 [references/source.md](references/source.md)。共同约定见 [../../bigquant/common.md](../../bigquant/common.md)，冲突处理见 [../../bigquant/MIGRATION.md](../../bigquant/MIGRATION.md)。

安装了本项目 extension 时，quant_load_agent 可加载本流程和 JSON 上下文；quant_reference 按行读取原参考。直接使用 /skill:bigquant-visual-strategy 时，从用户提供的资料或 context JSON 获取任务数据。除非用户另行授权，仅生成代码，不执行策略或平台查询。
