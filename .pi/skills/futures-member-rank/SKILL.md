---
name: futures-member-rank
description: 获取中金所（CFFEX）和郑商所（CZCE）每日会员成交量、持多单和持空单排名；用于查询最新交易日数据或某会员在指定交易所、品种、合约和指标中的官方名次。
---

# 期货会员排名

使用本 skill 回答中金所和郑商所会员成交持仓排名问题。两家交易所的数据格式不同，必须使用对应脚本，不要跨来源复用解析规则。

## 中金所（CFFEX）

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

## 郑商所（CZCE）

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
