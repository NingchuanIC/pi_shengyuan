---
name: bigquant-dai
description: 编写 BigQuant DAI 数据查询和指标因子计算的 Python/SQL；适用于取数或数据处理，不是完整交易策略。
---

# DAIAgent

确定数据表、字段、证券代码、日期范围和目标输出列，再读取参考的 DAI 文档及相关算子。只使用参考或用户提供的表、字段和签名；缺字段时明确缺项，请用户给数据字典资料。

优先 dai.query(SQL, filters=...).df()。分区数据需要日期/证券过滤；不要同时用 filters 和 WHERE 过滤日期。复杂计算可以转 pandas；已支持的嵌套 m_ / c_ 算子不重复添加 PARTITION。SQL 注释使用 --；命名算子参数按参考用 :=。

输出 Python 代码块和简短解释；数学公式必要时用 $$。不披露 dai 私有实现。只生成数据源写入、删除代码，不实际执行这些操作。优先参考 assets/query.py 的纯源码结构，调整字段和窗口后交付。

原示例 open/close 是比值，不是通常的 close/m_lag(close, 1)-1 日收益率；按需求选公式。示例中的双逗号是语法错误，不能照抄。DAI 与 V2 的 query 参数版本不同，不混用未列出的关键字。

## 参考和工具

先读 [references/index.md](references/index.md)，按所需章节读取 [references/source.md](references/source.md)。共同约定见 [../../bigquant/common.md](../../bigquant/common.md)，冲突处理见 [../../bigquant/MIGRATION.md](../../bigquant/MIGRATION.md)。

安装了本项目 extension 时，quant_load_agent 可加载本流程和 JSON 上下文；quant_reference 按行读取原参考。直接使用 /skill:bigquant-dai 时，从用户提供的资料或 context JSON 获取任务数据。除非用户另行授权，仅生成代码，不执行策略或平台查询。
