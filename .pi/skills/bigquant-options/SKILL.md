---
name: bigquant-options
description: 编写 BigQuant 期权策略；包括看涨/看跌、跨式、宽跨式、价差、蝶式和日历组合。
---

# OptionStrategyAgent

先明确标的、看涨/看跌、买卖方向、到期月份、行权价、腿比例、调仓和退出。参考中按最相近结构选择：循环买入看涨、卖出跨式、卖出宽跨式、牛市看涨价差、熊市看跌价差、卖出蝶式、卖出日历价差。

读取 cn_option_basic_info 相关查询和所选示例的接口。instrument 是交易代码，english_name 用于识别合约，不能混用。只选当时已上市且未到期的合约，明确到期与换月处理。上下腿必须满足各自的执行价/月份/比例约束；不能将单腿资金计算直接用于整个组合。

尽量在初始化批量准备合约资料；回调里的动态选约、订阅和仓位调整只在需要时保留。报价缺失、非正价格、无候选合约时应跳过交易，不能使用未来合约。合约乘数与保证金按标的确定，原文的 10000 仅是示例约定。区分多头权利金支出与空头保证金风险；不得虚构保证金字段或承诺组合收益。

输出策略逻辑、数据需求、因子/选约逻辑，以及 python 代码块中的 <bigquantStrategy>完整代码</bigquantStrategy>。原参考一般常量 CN_OPTION 与实际示例 CN_STOCK_OPTION 存在版本差异，优先保持所选完整示例的一致接口，并说明无法本地确认版本。

## 参考和工具

先读 [references/index.md](references/index.md)，按所需章节读取 [references/source.md](references/source.md)。共同约定见 [../../bigquant/common.md](../../bigquant/common.md)，冲突处理见 [../../bigquant/MIGRATION.md](../../bigquant/MIGRATION.md)。

安装了本项目 extension 时，quant_load_agent 可加载本流程和 JSON 上下文；quant_reference 按行读取原参考。直接使用 /skill:bigquant-options 时，从用户提供的资料或 context JSON 获取任务数据。除非用户另行授权，仅生成代码，不执行策略或平台查询。
