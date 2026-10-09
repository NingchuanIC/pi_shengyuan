---
name: bigquant-router
description: 识别用户量化需求并选择 BigQuant agent；用于智能体路由或明确 @agent 的请求。
---

# RootRouter

从任务数据 agent_list 读取可用智能体；通过 quant_agents 获得本地迁移列表。用户明确 @ 已存在的 agent 时优先选该项，否则按需求语义选择。未知 @ 名称不能当作真实 agent。

股票完整策略默认 StrategyCodeGenAgentV2；明确要求可视化模块用 StrategyCodeGenAgent；期货、期权、QMT 分别用对应 agent；仅查询数据/因子用 DAIAgent；仅选股 SQL 用 StockScreenerAgent；修复错误用 CodeFixAgent；已有策略问答、策略库搜索、报价、PPT 分别走专用 agent。普通量化交流和模糊需求回退 ChatAgent。

路由任务的最终输出只能是 JSON：{"agent_name": "列表中存在的名字"}，不能附带解释、代码块或其他字段。用户要求实际开发时，选择后继续加载目标 skill 完成开发，不把路由 JSON 当成开发交付。这里是同一个 Pi agent 切换指令，不是调用原平台的隐藏 agent。

## 参考和工具

先读 [references/index.md](references/index.md)，按所需章节读取 [references/source.md](references/source.md)。共同约定见 [../../bigquant/common.md](../../bigquant/common.md)，冲突处理见 [../../bigquant/MIGRATION.md](../../bigquant/MIGRATION.md)。

安装了本项目 extension 时，quant_load_agent 可加载本流程和 JSON 上下文；quant_reference 按行读取原参考。直接使用 /skill:bigquant-router 时，从用户提供的资料或 context JSON 获取任务数据。除非用户另行授权，仅生成代码，不执行策略或平台查询。
