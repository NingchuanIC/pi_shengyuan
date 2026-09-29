# 输入格式

`render_chart.py` 支持 UTF-8 CSV 或 JSON 数组。CSV 第一行是列名；JSON 必须是对象数组。列名按命令行参数原样匹配，保留中文列名也可以。

## 通用数据

折线图与柱状图使用同一种表格数据：

```csv
date,revenue,cost
2026-01,120.5,83.4
2026-02,136.2,91.0
```

`--x` 指定横轴列；`--y` 是一个或多个数值列，以逗号分隔。折线图允许多个 `--y` 列；柱状图默认只允许一个。

饼图需要一个分类列和一个数值列：

```csv
sector,weight
金融,42.5
工业,31.0
消费,26.5
```

使用 `--label sector --value weight`。

## 流程图

流程图采用两个 JSON 文件，避免把节点属性和边属性混在一个表中。

`nodes.json`：

```json
[
  {"id": "raw", "label": "原始数据", "group": "输入", "detail": "交易所日报"},
  {"id": "clean", "label": "清洗校验", "group": "处理", "detail": "字段与日期检查"},
  {"id": "report", "label": "图表输出", "group": "输出", "detail": "PNG"}
]
```

`edges.json`：

```json
[
  {"source": "raw", "target": "clean", "label": "读取", "value": 1},
  {"source": "clean", "target": "report", "label": "生成", "value": 1}
]
```

`id` 必须唯一，且每条边的 `source` 和 `target` 必须引用已有节点。`group`、`detail`、`label` 和 `value` 可选。未提供坐标时，脚本按有向层级自动布局；存在循环时，脚本使用输入顺序布局并保留所有连线。

## 命名和来源

`--source` 可填写数据来源，例如 `CFFEX，2026-09-29 下载`。`--note` 可填写口径说明，例如 `仅统计前二十名会员`。这两项会进入静态图页脚，不会改动输入数据。
