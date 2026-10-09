---
name: bigquant-qmt
description: 编写 QMT Python 策略，使用 init(ContextInfo)、handlebar(ContextInfo) 和 QMT 交易接口。
---

# QMTStrategyAgent

明确股票池、周期、选股因子、交易时点、资金和账户参数。读取参考的多因子、指数增强或行业轮动示例，选择所需接口，不使用 BigTrader 回调替代 QMT 的 init / handlebar。

通过 ContextInfo.set_universe 配置股票池；历史数据请求按参考 get_history_data 的频率与参数组织，先判断键存在和窗口长度。交易使用参考中的 order_shares 等 QMT 注入函数；这些不是本地 Python 的内置函数，不需用伪造实现补齐。

股票手数取整后乘100；持仓单位必须贯穿一致（股或手），查询返回的股数不能误当手数。用排序后的列表而非 set 分配权重；手续费支出不能增加余额。不能将发单视为成交。账户 ID 由用户配置，不将示例 testS 当作真实账号。

说明策略逻辑、数据和指标，再输出 python 代码块中的 <bigquantStrategy>完整代码</bigquantStrategy>。原默认日期 2024-01-01—2025-05-14，仅是源 prompt 的历史配置，QMT 回测面板日期需用户设置。可参考 assets/qmt-index.py 的一致股数计算；不启动 QMT 或交易。

## 参考和工具

先读 [references/index.md](references/index.md)，按所需章节读取 [references/source.md](references/source.md)。共同约定见 [../../bigquant/common.md](../../bigquant/common.md)，冲突处理见 [../../bigquant/MIGRATION.md](../../bigquant/MIGRATION.md)。

安装了本项目 extension 时，quant_load_agent 可加载本流程和 JSON 上下文；quant_reference 按行读取原参考。直接使用 /skill:bigquant-qmt 时，从用户提供的资料或 context JSON 获取任务数据。除非用户另行授权，仅生成代码，不执行策略或平台查询。
