# Prompt 到 Pi 的迁移说明

迁移对象是 Home-12 中14份暴露的 prompt。每份映射为一个独立 skill；API、字段、例子及原文规则完整保存在各自的 references/source.md，并按 Markdown 标题建立行号索引。agents.json 保存来源文件名、技能路径、别名、上下文键和 SHA-256 摘要，方便逐项核对。

本实现复用 Pi 当前模型与工具系统，不复制原平台的隐藏 agent 代码，也不提供 BigQuant SDK、行情权限、回测运行环境或交易服务。extension 负责发现、加载、上下文注入、参考分页和代码提取；skills 负责领域流程与输出要求；Python 辅助脚本负责可确定的文件处理和静态检查。

| 原 agent | Skill | 实际行为 |
|---|---|---|
| RootRouter | bigquant-router | 按需求/显式 @ 名称路由；仅路由时输出 agent_name JSON |
| ChatAgent | bigquant-chat | 平台与量化交流、概念解释、主观思想量化 |
| CodeFixAgent | bigquant-code-fix | 按部分/完整范围修复；保留 bigquantAIFix 与 Markdown |
| DAIAgent | bigquant-dai | DAI 查询、SQL 因子和 DataFrame 处理 |
| DemandPriceAgent | bigquant-demand-price | 十字以内需求标题和1499—5999整数报价标签 |
| FutureStrategyAgent | bigquant-futures | 主连因子、真实合约、双向交易与换月 |
| OptionStrategyAgent | bigquant-options | 选约和多腿期权组合；保留全部七类例子 |
| PPTAgent | bigquant-ppt | 中文幻灯片内容，每页正文100字以内 |
| QMTStrategyAgent | bigquant-qmt | QMT init / handlebar 策略 |
| StockScreenerAgent | bigquant-stock-screener | SQL、option、stockstrategyname、stockscreener 标签 |
| StrategyChatAgent | bigquant-strategy-chat | 已有策略解释及按明确权限披露代码 |
| StrategyCodeGenAgent | bigquant-visual-strategy | 原版 M.xxx.vN 可视化模块与图标记 |
| StrategyCodeGenAgentV2 | bigquant-stock-strategy | 新版 DAI + BigTrader 股票 Python |
| StrategySearchAgent | bigquant-strategy-search | 从真实策略目录返回非空 strategy_id JSON |

## 原文冲突与迁移处理

- StrategyChatAgent 同时写了“不提供代码”和“按来源输出代码”。新增显式上下文 expose_strategy_code，默认 false；仅 true 且来源不是 community_discussion 时可输出。原始两条指令原样保留，未隐去。这个选项是模型输出约定，不构成权限隔离或机密防泄漏技术保证。
- StrategySearchAgent 要求没有结果时返回小市值策略且 ID 不得为空。如果用户提供的策略库没有相关策略或小市值项，不能编造 ID；先请求补充目录。语义相关性由模型判断，没有用硬编码词表假冒原 agent 的搜索算法。
- 旧可视化生成器的 __examples_s__ 没有对应模板文件。作为必需输入显式提供；不擅自造模板默认过滤条件。原文未指定版本的模块从输入模板获取，不猜版本。
- RootRouter 的 __agent_list__ 在本地由实际14项映射生成（排除路由器自身）；@ 名称支持真实 ID、skill 名和别名。路由 JSON 使用规范 ID。
- 策略问答的四个策略上下文键和搜索的 __strategy_s__ 从用户资料或 context JSON 获取。源码中的 __init__ 等 Python 特殊方法不会被当作占位符替换。
- 部分 SQL 示例缺少列间逗号、DAI 示例出现双逗号；新代码需修正这些语法笔误。日收益率通常是 close / m_lag(close, 1) - 1，原例 open/close 仅保留作来源，不能当成相同定义。
- “连续三天上涨”不同于“三天累计涨幅为正”。选股 skill 要求按原需求精确实现，不能照抄错误说明。
- 历史窗口在时间上向前取，源 prompt 中 start_date + 10 days 的个别说明错误不能照抄。历史数据只用于预热因子。
- DAI、V2、期货与期权的接口版本不完全一致。各 skill 保留各自参考，生成时选一种一致版本，不声称本地已经确认。CN_OPTION / CN_STOCK_OPTION、行业名称字段及 query 参数的冲突明确交给实际部署平台资料确认。
- 期货主连仅用于因子；真实下单用 dominant。原样例中移仓后重复使用旧持仓和主连报价的风险由 skill 明确提醒。新增手数模板仅演示固定手数信号，不声称完成实盘成交追踪与保证金管理。
- QMT 示例里 set 的顺序、股/手单位以及手续费方向存在问题。新增模板按稳定列表、股数和资金支出处理；原文依旧完整保留供核对。
- 提供的历史默认日期、会员价格及模块版本是快照，不自动改成今天或宣称“当前最新”。

## 交付边界

平台标签属于回答格式，不是 Python。导出脚本只剥外层标签或 Python 代码块；不会对代码中的比较符号或 & 做 HTML 解码。

check_python.py 使用 compile(source, filename, 'exec') 创建代码对象，不执行它、不会导入源码中的 SDK，也不产生策略的 .pyc。Python 语法检查不识别 SQL 字符串错误，不验证字段、交易接口、结果正确性或策略可盈利性。validate_output.py 仅做标签、JSON 等基本格式约束，不证明全部自然语言输出要求已满足。

只交付代码和 Markdown。不存在未授权的联网查询、SDK安装、策略执行、回测、模拟或实盘交易。新增模板是供模型参考并改写的完整纯 Python 示例，不能在未配置平台与账户时当作本地可运行应用。
