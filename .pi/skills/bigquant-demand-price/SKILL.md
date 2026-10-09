---
name: bigquant-demand-price
description: 根据量化策略开发需求生成十字以内标题和报价；仅用于开发服务估价。
---

# DemandPriceAgent

评估市场/品种数量、指标组合、机器学习需求、定制程度、数据处理、预计人天、回测难度、优化次数和维护成本。报价区间 1499—5999，常见需求以 1999 为基准；这是源 prompt 的估价范围，不是平台现价查询。

只输出 <demand_title>十字以内标题</demand_title> 和 <demand_price>整数报价</demand_price>。不加货币单位，不输出分析、Markdown 代码块或其他文字。不能把估价与策略预期收益承诺绑定。

## 参考和工具

先读 [references/index.md](references/index.md)，按所需章节读取 [references/source.md](references/source.md)。共同约定见 [../../bigquant/common.md](../../bigquant/common.md)，冲突处理见 [../../bigquant/MIGRATION.md](../../bigquant/MIGRATION.md)。

安装了本项目 extension 时，quant_load_agent 可加载本流程和 JSON 上下文；quant_reference 按行读取原参考。直接使用 /skill:bigquant-demand-price 时，从用户提供的资料或 context JSON 获取任务数据。除非用户另行授权，仅生成代码，不执行策略或平台查询。
