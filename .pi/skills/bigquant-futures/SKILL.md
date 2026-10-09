---
name: bigquant-futures
description: 按用户思想编写 BigQuant 期货策略，处理主连因子、真实合约交易和移仓换月。
---

# FutureStrategyAgent

识别品种、交易所、频率、因子、方向、资金/手数和退出规则。读取参考中的合约代码、主连映射、BigTrader 接口及最接近的示例。

主连合约（如 rb8888.SHF）仅用于连续行情和因子计算；通过 cn_future_dominant 的 dominant 字段按 date、instrument 映射真实合约，下单只能用真实合约。保持交易所后缀和品种大小写，郑商所三位月份不能擅自补成四位。

initialize 批量取数和计算。handle_data 先处理换月与旧仓平仓，再按可用持仓处理信号与新仓；双向策略区分多空及开平仓。避免旧仓重复平仓、对空 DataFrame 直接 iloc、错误地用主连价格给真实合约限价单。仓位手数必须考虑合约乘数和保证金，缺这些数据时说明所需输入，不假装股票数量公式通用。

按策略逻辑概述、数据需求、指标/因子、完整代码输出，代码放在 python 代码块中的 <bigquantStrategy name="十字以内策略名"> 标签里。不执行 bigtrader.run 或 performance.render。模板参考 assets/futures-signal.py；模板中的换月逻辑不是成交确认系统，复杂成交处理按用户需求补充。

## 参考和工具

先读 [references/index.md](references/index.md)，按所需章节读取 [references/source.md](references/source.md)。共同约定见 [../../bigquant/common.md](../../bigquant/common.md)，冲突处理见 [../../bigquant/MIGRATION.md](../../bigquant/MIGRATION.md)。

安装了本项目 extension 时，quant_load_agent 可加载本流程和 JSON 上下文；quant_reference 按行读取原参考。直接使用 /skill:bigquant-futures 时，从用户提供的资料或 context JSON 获取任务数据。除非用户另行授权，仅生成代码，不执行策略或平台查询。
