---
name: static-charting
description: 使用 Matplotlib 生成规范的静态 PNG 图表；适用于折线图、柱状图、饼图和流程图。
---

# 规范静态图表

使用本 skill 将已验证的数据制作为高分辨率 PNG。不要用图表补全缺失数据、猜测单位或拼接不同口径的数据。

需要常规 CPython 3 和 matplotlib；不支持 free-threading Python。

## 选择图表

- 时间序列或连续顺序：折线图。
- 离散项目比较：柱状图；项目较多时优先横向柱状图。
- 同一总体、互斥类别且类别数为 2–6：饼图；超过 6 类改用排序柱状图。
- 步骤、审批、系统依赖或资金/数据流：流程图。

柱状图从零基线开始。除非用户明确要求，不使用双纵轴、3D、彩虹色或误导性的截断柱状轴。

## 生成

阅读 [输入格式](references/input-formats.md) 后运行脚本。所有路径显式传入，且不得覆盖原始数据。

```powershell
# 折线图
python scripts/render_chart.py --type line --input monthly.csv --x date --y revenue,cost --title "月度收入与成本" --y-label "金额（万元）" --image output/monthly.png

# 排序横向柱状图
python scripts/render_chart.py --type bar --input ranking.csv --x member --y volume --orientation horizontal --title "成交量排名" --y-label "成交量（手）" --image output/ranking.png

# 饼图
python scripts/render_chart.py --type pie --input allocation.csv --label sector --value weight --title "行业权重" --image output/allocation.png

# 流程图
python scripts/render_chart.py --type flow --nodes flow-nodes.json --edges flow-edges.json --title "数据处理流程" --image output/flow.png
```

运行前检查环境。Python 必须是常规构建，`python --version` 的输出不得含有 `free-threading build`。若缺少运行时或包，明确说明并给出安装命令；不要悄悄切换 Python 环境。

```powershell
python --version
python -c "import matplotlib; print(matplotlib.__version__)"
```

推荐安装命令：

```powershell
conda activate pi-dev
conda install -c conda-forge python matplotlib
```

安装会改变环境，只有在用户同意后执行。

脚本只依赖 Matplotlib。当前环境是 free-threading Python 时，脚本会明确报错，而不是自动回退到其他解释器。

## 输出要求

- 每张 PNG 都有标题、适用时的轴与单位、可读图例、数据来源和生成时间。
- 默认 160 DPI、白底、克制网格和可辨识颜色/线型。
- 图中展示格式化数值；不得为“好看”而改动数值、日期顺序或类别名称。
- 输出文件位于用户指定目录；在最终答复中给出 PNG 的绝对路径。

当会话在 Pi Web 中运行时，PNG 生成成功后，使用 Pi 内建的 `read` 工具读取该 PNG 文件。`read` 的图片内容会作为原生 image block 显示在 Pi Web 的工具结果中。不要生成 HTML、使用自定义指令或 Markdown 图片链接。

## 质量检查

交付前确认：数据点数与输入一致；颜色和图例一一对应；标题、单位和来源准确；中文未显示为方块；柱状图未裁切；标签不重叠；PNG 文件存在并可打开。数据量大时，优先通过聚合或分面避免标签和线条重叠，并在改变数据粒度前征求用户同意。
