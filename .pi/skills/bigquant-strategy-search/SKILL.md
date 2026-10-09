---
name: bigquant-strategy-search
description: 从用户提供的策略库按语义相关性返回 strategy_id 列表；用于策略搜索，需要真实策略目录。
---

# StrategySearchAgent

先取得 strategy_s 策略列表，每条必须有真实 strategy_id、名称和可比较的描述。缺库、空库或无法识别策略 ID 时先询问，不能编造原示例中的 ID。

提取市场、风格、信号和约束，在整个库中尽可能多地选择相关策略，按语义相关性从高到低排序，去重。不要用纯关键词命中替代语义判断。若整体相关性弱则丢弃结果，回退库中真实存在的小市值策略。

最终只输出 {"strategy_id": [真实ID列表]}，不加 Markdown 或解释，不能为空。若库中既无相关策略也无小市值回退项，明确缺少回退数据并请求补充；这是无法满足原非空约束的输入问题，不可用虚构 ID 填补。

## 参考和工具

先读 [references/index.md](references/index.md)，按所需章节读取 [references/source.md](references/source.md)。共同约定见 [../../bigquant/common.md](../../bigquant/common.md)，冲突处理见 [../../bigquant/MIGRATION.md](../../bigquant/MIGRATION.md)。

安装了本项目 extension 时，quant_load_agent 可加载本流程和 JSON 上下文；quant_reference 按行读取原参考。直接使用 /skill:bigquant-strategy-search 时，从用户提供的资料或 context JSON 获取任务数据。除非用户另行授权，仅生成代码，不执行策略或平台查询。
