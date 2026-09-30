---
name: futures-member-rank
description: 获取中金所（CFFEX）和郑商所（CZCE）每日会员成交量、持多单和持空单排名；用于查询最新交易日数据或某会员在指定交易所、品种、合约和指标中的官方名次。
---

# 期货会员排名

使用本 skill 回答中金所和郑商所会员成交持仓排名问题。排名数据必须优先来自已注入的结构化数据能力；直接抓取交易所文件是最后一级回退。两家交易所的数据格式不同，不能跨来源复用解析规则。

## 数据来源优先级

1. **已注入的结构化排名数据能力（最高优先级）**：先查找当前会话中可用、能按交易所代码和交易日查询期货会员排名的工具，并直接调用它。查询时使用交易所代码 `CFFEX` 或 `CZCE` 与 `YYYYMMDD` 交易日；仅在工具返回的字段已明确表达时，才据此筛选会员、品种/合约和 `volume`、`long`、`short` 指标。
2. **交易所官方静态文件（最终回退）**：仅当已确认没有可用的结构化排名工具，或者该工具因连接失败、认证失败、持续服务错误或不支持该查询而无法取得数据时，才运行本 skill 的抓取脚本。不得因为工具返回空结果、会员未上榜、交易日未发布或非交易日而改用抓取脚本。

调用结构化数据能力前先确认其输入约束和返回字段。常见排名记录应以 `instrument_id`/`product_id`、`ranking_type`、`rank`、`member_name`、`volume` 和 `change_from_previous_day` 表达；`ranking_type` 的 `volume`、`long_open_interest`、`short_open_interest` 分别对应成交量、持多单、持空单。它可用且已返回有效响应时，视为该请求的权威来源；不要同时抓取网页来交叉验证或补充结果。若其返回的数据未覆盖所需的品种、合约、会员或指标，说明该限制，不要自行抓取补齐。只有在进入最终回退后，才使用下列脚本和官方 URL。

## 中金所（CFFEX，最终回退）

官方页面为 <http://www.cffex.com.cn/cn/ccpm.html>，实际的每日数据文件为：

```text
http://www.cffex.com.cn/sj/ccpm/YYYYMM/DD/{IF|IH|IC|IM|TS|TF|T|TL}_1.csv
```

运行本目录的 `scripts/cffex_rank.mjs`，不要根据搜索摘要、第三方数据源或旧缓存回答。

```powershell
# 获取当天的汇总；不回溯至此前交易日
node scripts/cffex_rank.mjs

# 查询会员在全部中金所品种、所有合约、三类指标中的官方名次
node scripts/cffex_rank.mjs --member "中信期货"

# 精确指定交易日、品种、合约与指标
node scripts/cffex_rank.mjs --date 20250926 --products IF --contract IF2510 --metric long --member "中信期货"

# 保存该交易日的全部扁平化记录，便于后续本地分析
node scripts/cffex_rank.mjs --date latest --format json --output cffex-rank.json
```

`--date latest` 是默认值，仅表示执行时的中国日期；不会推断“最近已公布交易日”，也不会回溯至较早日期。查询历史数据必须显式传 `--date YYYYMMDD`。若所请求日期返回 404，脚本会报告该日期数据可能尚未发布或为非交易日。`--products` 接受逗号分隔的 `IF,IH,IC,IM,TS,TF,T,TL`，`--metric` 为 `volume`、`long`、`short` 或 `all`。

## 郑商所（CZCE，最终回退）

官方排名页面为 <https://www.czce.com.cn/cn/jysj/jdcjpm/H077003006index_1.htm>。该页面启用了浏览器验证；脚本改抓取同一交易日的官方静态持仓排名 XLS，而不是尝试把中金所的 CSV URL 模式套用过来：

```text
http://www.czce.com.cn/cn/DFSStaticFiles/Future/YYYY/YYYYMMDD/FutureDataHolding.xls
```

```powershell
# 获取当天的郑商所排名汇总；不回溯至此前交易日
node scripts/czce_rank.mjs

# 查询某会员在郑商所全部已公布表中的名次
node scripts/czce_rank.mjs --member "中信期货"

# 精确指定日期、合约/品种标签与指标
node scripts/czce_rank.mjs --date 20250926 --contract SR601 --metric short --member "中信期货"

# 保存指定当天的完整结果
node scripts/czce_rank.mjs --date latest --format json --output czce-rank.json
```

郑商所 XLS 同时可能含品种汇总表和具体合约表。结果中的 `instrument` 完全保留交易所表头中的品种/合约标签；不能在未确认标签粒度时将品种汇总和具体合约进行合并或比较。

`--date latest` 仅表示执行时的中国日期；不会推断“最近已公布交易日”，也不会回溯至较早日期。查询历史数据必须显式传 `--date YYYYMMDD`。同一请求日期会兼容交易所发布的 XLSX 和 XLS 文件格式；若两种格式均返回 404，脚本会报告该日期数据可能尚未发布或为非交易日。

回答排名时必须同时说明交易所、交易日、品种/合约标签和指标：每个表分别公布成交量、持多单、持空单三套排名，不能把它们混为一个“总排名”，也不能跨合约自行汇总为官方名次。会员未出现在结果中，只能表述为“未进入该表该指标的官方前 20 名”，不能称为“没有排名”。会员名称默认是包含匹配；若出现多个同名或近似名称，列出完整官方名称并请用户确认。

若脚本没有找到数据，报告脚本输出的请求日期和失败原因；不要自行改查其他日期。交易日数据通常在收市后更新；不要把尚未发布或非交易日解释成零持仓或零成交。

## 保存结果后的筛选与交付

`--output` 保存的是完整原始载荷，其中筛选前的记录位于 `records`。它**不**保存 `selected_records`，即使命令行同时传了 `--contract`、`--member` 或 `--metric`。`selected_records` 只会在不使用 `--output` 且指定 `--format json` 时出现在标准输出中。

因此，用户要求导出 CSV、计算或制作图表时，先用 `--output` 获取完整载荷，再从 `records` 过滤；不要读取不存在的 `selected_records`。字段按交易所区分：

- CFFEX：`product`、`contract`、`metric`、`rank`、`member`、`value`、`change`。
- CZCE：`exchange`、`instrument`、`metric`、`rank`、`member`、`value`、`change`。

例如，筛选中金所 T2612 的成交量前十名，条件是 `record.contract === "T2612" && record.metric === "volume" && record.rank <= 10`。郑商所则使用 `instrument`，不要将它当作 CFFEX 的 `contract`。

所有中间 JSON、分析脚本、CSV 和图表文件都保存在**项目根目录**的 `tmp/`，不要使用系统临时目录。开始后若目录不存在，先创建它：

```powershell
New-Item -ItemType Directory -Force -Path tmp | Out-Null
```

例如，使用 `tmp/cffex-rank.json`、`tmp/extract_rank.mjs` 和 `tmp/T2612-volume-top10.csv`。在 Windows 的 Git Bash 中，`/tmp` 是 Bash 的 POSIX 路径，而 Node 可能将其解释成 `D:\tmp`；因此不得在 Bash 或 Node 中使用或硬编码 `/tmp/...`。后续读取和写入都使用项目根目录相对路径 `tmp/...`。

如果用户要求的结果是文件、表格、计算或图表，抓取数据只是中间步骤：继续完成筛选、写出或展示该结果，并确认文件已经生成或表格已经得到。发现字段名或路径不符时，先修正并执行下一步；这类诊断不能作为最终回复。只有交付完成，或遇到无法自行解决的外部阻塞（例如交易所未发布数据、网络持续失败）时，才结束本轮。
