# BigQuant agents for Pi

14个 agent 的入口、extension 与辅助脚本已放在项目 .pi 下。Pi 重新加载项目资源后可发现，不需要修改 pi 核心源码或安装新增依赖。项目信任流程仍由 Pi 管理。

## 使用

在本仓库打开 Pi，运行 /reload 后：

```text
/quant list
/quant stock 编写一个每5个交易日调仓的动量策略，持有10只股票，只生成代码
/quant futures 编写螺纹钢主连双均线策略，交易真实主力合约，只生成代码
/quant qmt 将指数增强思路写成QMT策略
/skill:bigquant-stock-screener 筛选连续三天上涨且总市值小于100亿元的股票
/quant router @DAIAgent 查询指定股票日线数据
```

`/quant <agent> <需求>` 一次加载指定流程并发送需求，支持规范 agent ID、别名和 skill 名，不改变模型，也不调用原平台 agent。自然语言任务可由 Pi 根据各 skill 的描述选择；需要明确控制时用 /quant 或 /skill:名字。路由器支持两种目的：用户仅问路由时返回 JSON，用户请求开发时选择后继续完成目标任务。

模型可调用的工具：

- quant_agents：完整目录。
- quant_load_agent：读 skill、共同约定和所需上下文。
- quant_reference：按原参考行号分页读取，每页最多200行。
- quant_extract_code：从回答提取纯 Python/SQL，返回全部候选供模型另存文件。

## 上下文

策略搜索需要真实策略目录；策略问答需要来源、描述、代码、绩效；旧版可视化生成需要完整模板。可直接在用户消息中提供这些资料，或填写 context.example.json 后另存自己的 JSON。示例中的空列表和文字说明不是实际数据。

PowerShell 中为 /quant 命令提供上下文文件：

```powershell
$env:BIGQUANT_CONTEXT_FILE = 'D:\path\context.json'
```

在启动 Pi 的终端设置该环境变量；已启动的 Pi 需要重新启动才能继承。模型工具 quant_load_agent / quant_reference 也可通过 context_file 参数直接指定文件，不必修改环境。路径相对 Pi 当前工作目录解析；加载上下文只读取本地 JSON。策略源代码会进入当前 Pi 模型上下文，需按公司模型使用规范选择供应商。

上下文键：agent_list 由本地目录生成；strategy_s 是含 strategy_id、name、description 的数组；examples_s 是完整模板文本；strategysource、strategydesc、strategycode、strategyperformance 供已有策略问答使用；expose_strategy_code 默认 false。只注入当前 agent 所需字段，避免把完整策略库传给无关 agent。

原 prompt 也可以不经过 Pi，单独填充成 Markdown：

```powershell
python -B .pi/bigquant/scripts/render_prompt.py StrategyCodeGenAgentV2 --output generated-prompt.md
python -B .pi/bigquant/scripts/render_prompt.py StrategySearchAgent --context 'D:\path\context.json' --output search-prompt.md
```

文件已存在则失败，明确覆盖时加 --overwrite。缺必要上下文则失败，不默默填充虚构策略。

## 导出与静态检查

将生成回答保存为 answer.md，先导出纯代码再编译：

```powershell
python -B .pi/bigquant/scripts/extract_output.py answer.md --output strategy.py
python -B .pi/bigquant/scripts/check_python.py strategy.py
```

也可直接检查带标签的回答，不写代码文件：

```powershell
python -B .pi/bigquant/scripts/check_python.py answer.md --response
python -B .pi/bigquant/scripts/validate_output.py StrategyCodeGenAgentV2 answer.md
python -B .pi/bigquant/scripts/check_resources.py --source-dir 'D:\important\shengyuan\Home-12'
```

多个代码候选先不加 --output 查看 JSON，再用 --index 选择。SQL 输出保存到 .sql 文件，Python 编译器不能验证 SQL。

TypeScript extension 的独立类型检查和仓库要求的检查：

```powershell
node node_modules/typescript/bin/tsc --project .pi/bigquant/tsconfig.json --noEmit
npm run check
```

不调用 BigQuant 或 QMT。编译检查不会验证接口、行情权限、回测结果、成交逻辑或收益。

## 文件

- [.pi/skills 下的14项映射](agents.json)：每项有 SKILL.md、完整源 prompt、行号索引；部分有纯 Python 模板。
- [extension](../extensions/bigquant/index.ts)：注册命令和工具。
- [runtime.ts](runtime.ts)：目录读取、上下文处理、prompt 填充与代码提取。
- [MIGRATION.md](MIGRATION.md)：原文冲突、示例笔误、迁移约定及能力边界。
- [common.md](common.md)：各 agent 共同遵循的代码生成规则。

迁出本仓库时一起复制 .pi/bigquant、.pi/extensions/bigquant 及 .pi/skills/bigquant-*，以保留相对路径。
