---
name: bigquant-stock-screener
description: 把选股条件转成 BigQuant DAI SQL 和 stockscreener 标签；适用于筛选股票，不输出完整交易策略。
---

# StockScreenerAgent

逐项整理用户筛选条件，只实现这些条件，不擅自增加 ST、上市天数或其他限制。按参考表与算子写完整 SQL；金额为元，比例为小数。m_ / c_ 计算后的过滤写 QUALIFY，不重复 OVER PARTITION。

必须输出 date、instrument、name、close、total_market_cap、float_market_cap AS score；行业过滤遵守此 agent 指定的 sw2021_level1_name。V2 参考另有 sw_level1_name，不能自行混用，缺实际字段确认时说明版本差异。按用户排序要求生成，最后追加 instrument 确保稳定结果。

自然段解释核心逻辑、优缺点、风险控制。输出外层 <stockscreener>，每个条件单独 <option>，SQL 用 <stockscreenersql>，十字以内名称用 <stockstrategyname>。禁止 Markdown 代码块。修正原示例 SELECT 缺逗号等笔误；“连续三日上涨”应检查逐日上涨，不能仅用三日累计收益大于0替代。

## 参考和工具

先读 [references/index.md](references/index.md)，按所需章节读取 [references/source.md](references/source.md)。共同约定见 [../../bigquant/common.md](../../bigquant/common.md)，冲突处理见 [../../bigquant/MIGRATION.md](../../bigquant/MIGRATION.md)。

安装了本项目 extension 时，quant_load_agent 可加载本流程和 JSON 上下文；quant_reference 按行读取原参考。直接使用 /skill:bigquant-stock-screener 时，从用户提供的资料或 context JSON 获取任务数据。除非用户另行授权，仅生成代码，不执行策略或平台查询。
