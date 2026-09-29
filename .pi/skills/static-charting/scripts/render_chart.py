#!/usr/bin/env python3
"""Render publication-ready Matplotlib PNG charts from local data."""

from __future__ import annotations

import argparse
import csv
import json
import math
import sys
from collections import defaultdict, deque
from datetime import datetime
from pathlib import Path
from typing import Any

import matplotlib

matplotlib.use("Agg")
import matplotlib.patches as patches
import matplotlib.pyplot as plt
from matplotlib.ticker import FuncFormatter


COLORS = ["#1565C0", "#EF6C00", "#2E7D32", "#7B1FA2", "#00838F", "#C62828"]
GRID_COLOR = "#D9E1EA"
TEXT_COLOR = "#1F2937"
MUTED_COLOR = "#5B6472"


def fail(message: str) -> None:
    raise ValueError(message)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--type", required=True, choices=("line", "bar", "pie", "flow"))
    parser.add_argument("--input", type=Path, help="CSV or JSON array for line, bar, or pie charts")
    parser.add_argument("--nodes", type=Path, help="JSON node array for a flow chart")
    parser.add_argument("--edges", type=Path, help="JSON edge array for a flow chart")
    parser.add_argument("--x", help="Category or time column for line/bar charts")
    parser.add_argument("--y", help="Comma-separated numeric columns for line/bar charts")
    parser.add_argument("--label", help="Category column for pie charts")
    parser.add_argument("--value", help="Numeric column for pie charts")
    parser.add_argument("--orientation", choices=("vertical", "horizontal"), default="vertical")
    parser.add_argument("--title", required=True)
    parser.add_argument("--x-label", default="")
    parser.add_argument("--y-label", default="")
    parser.add_argument("--source", default="用户提供数据")
    parser.add_argument("--note", default="")
    parser.add_argument("--image", type=Path, required=True)
    return parser.parse_args()


def configure_matplotlib() -> None:
    plt.rcParams.update(
        {
            "font.sans-serif": ["Microsoft YaHei", "SimHei", "Noto Sans CJK SC", "Arial Unicode MS", "DejaVu Sans"],
            "axes.unicode_minus": False,
            "figure.facecolor": "white",
            "axes.facecolor": "white",
            "axes.edgecolor": "#AAB4C3",
            "axes.labelcolor": TEXT_COLOR,
            "xtick.color": MUTED_COLOR,
            "ytick.color": MUTED_COLOR,
            "text.color": TEXT_COLOR,
        }
    )


def load_array(path: Path) -> list[dict[str, Any]]:
    if not path.is_file():
        fail(f"找不到输入文件：{path}")
    if path.suffix.lower() == ".csv":
        with path.open("r", encoding="utf-8-sig", newline="") as file:
            rows = list(csv.DictReader(file))
    elif path.suffix.lower() == ".json":
        with path.open("r", encoding="utf-8") as file:
            rows = json.load(file)
    else:
        fail("输入仅支持 .csv 或 .json")
    if not isinstance(rows, list) or not rows or not all(isinstance(row, dict) for row in rows):
        fail(f"{path} 必须包含至少一条对象记录")
    return rows


def numeric(value: Any, column: str) -> float:
    if isinstance(value, bool):
        fail(f"列 {column} 含有布尔值，不能作为数值")
    try:
        result = float(value)
    except (TypeError, ValueError) as error:
        raise ValueError(f"列 {column} 包含无法转换的数值：{value!r}") from error
    if not math.isfinite(result):
        fail(f"列 {column} 包含非有限数值：{value!r}")
    return result


def require_columns(rows: list[dict[str, Any]], columns: list[str]) -> None:
    missing = [column for column in columns if any(column not in row for row in rows)]
    if missing:
        fail("输入缺少列：" + ", ".join(missing))


def source_caption(args: argparse.Namespace) -> str:
    created = datetime.now().astimezone().strftime("%Y-%m-%d %H:%M %z")
    note = f"；口径：{args.note}" if args.note else ""
    return f"来源：{args.source}；生成：{created}{note}"


def number_text(value: float) -> str:
    return f"{value:,.4f}".rstrip("0").rstrip(".")


def finish_static(fig: plt.Figure, args: argparse.Namespace) -> None:
    fig.text(0.01, 0.012, source_caption(args), ha="left", va="bottom", fontsize=8, color=MUTED_COLOR)
    args.image.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(args.image, dpi=160, bbox_inches="tight", facecolor="white")
    plt.close(fig)


def render_line(args: argparse.Namespace, rows: list[dict[str, Any]]) -> None:
    if not args.x or not args.y:
        fail("折线图需要 --x 和 --y")
    series = [value.strip() for value in args.y.split(",") if value.strip()]
    if not series:
        fail("--y 至少包含一个列名")
    require_columns(rows, [args.x, *series])
    x_values = [str(row[args.x]) for row in rows]
    values = {name: [numeric(row[name], name) for row in rows] for name in series}

    configure_matplotlib()
    fig, axis = plt.subplots(figsize=(10.5, 6.2))
    for index, name in enumerate(series):
        axis.plot(x_values, values[name], label=name, color=COLORS[index % len(COLORS)], linewidth=2.3, marker="o", markersize=4)
    axis.set_title(args.title, loc="left", fontsize=16, fontweight="bold", pad=16)
    axis.set_xlabel(args.x_label or args.x)
    axis.set_ylabel(args.y_label)
    axis.yaxis.set_major_formatter(FuncFormatter(lambda value, _: number_text(value)))
    axis.grid(axis="y", color=GRID_COLOR, linewidth=0.8)
    axis.spines[["top", "right"]].set_visible(False)
    axis.legend(frameon=False, ncol=min(3, len(series)), loc="upper left")
    fig.autofmt_xdate(rotation=30, ha="right")
    finish_static(fig, args)

def render_bar(args: argparse.Namespace, rows: list[dict[str, Any]]) -> None:
    if not args.x or not args.y:
        fail("柱状图需要 --x 和 --y")
    series = [value.strip() for value in args.y.split(",") if value.strip()]
    if len(series) != 1:
        fail("柱状图当前需要且只接受一个 --y 列")
    value_column = series[0]
    require_columns(rows, [args.x, value_column])
    labels = [str(row[args.x]) for row in rows]
    values = [numeric(row[value_column], value_column) for row in rows]
    if args.orientation == "horizontal":
        labels, values = zip(*sorted(zip(labels, values), key=lambda pair: pair[1]))
        labels, values = list(labels), list(values)

    configure_matplotlib()
    fig, axis = plt.subplots(figsize=(10.5, max(5.8, len(labels) * 0.45 + 1.8)))
    if args.orientation == "horizontal":
        bars = axis.barh(labels, values, color=COLORS[0])
        axis.set_xlabel(args.y_label or value_column)
        axis.set_ylabel(args.x_label or args.x)
        axis.bar_label(bars, labels=[number_text(value) for value in values], padding=4, fontsize=9)
        axis.grid(axis="x", color=GRID_COLOR, linewidth=0.8)
    else:
        bars = axis.bar(labels, values, color=COLORS[0], width=0.65)
        axis.set_xlabel(args.x_label or args.x)
        axis.set_ylabel(args.y_label or value_column)
        axis.bar_label(bars, labels=[number_text(value) for value in values], padding=3, fontsize=9)
        axis.grid(axis="y", color=GRID_COLOR, linewidth=0.8)
        axis.tick_params(axis="x", rotation=30)
    axis.set_title(args.title, loc="left", fontsize=16, fontweight="bold", pad=16)
    axis.spines[["top", "right"]].set_visible(False)
    axis.set_axisbelow(True)
    finish_static(fig, args)

def render_pie(args: argparse.Namespace, rows: list[dict[str, Any]]) -> None:
    if not args.label or not args.value:
        fail("饼图需要 --label 和 --value")
    require_columns(rows, [args.label, args.value])
    labels = [str(row[args.label]) for row in rows]
    values = [numeric(row[args.value], args.value) for row in rows]
    if not 2 <= len(labels) <= 6:
        fail("饼图只适合 2–6 个互斥类别；请改用柱状图")
    if any(value < 0 for value in values) or sum(values) <= 0:
        fail("饼图数值必须为非负，且总和大于零")

    configure_matplotlib()
    fig, axis = plt.subplots(figsize=(9.2, 6.2))
    axis.pie(values, labels=labels, colors=COLORS[: len(labels)], autopct="%.1f%%", startangle=90, counterclock=False, wedgeprops={"linewidth": 1, "edgecolor": "white"}, textprops={"fontsize": 10})
    axis.set_title(args.title, loc="left", fontsize=16, fontweight="bold", pad=16)
    axis.axis("equal")
    finish_static(fig, args)

def flow_positions(nodes: list[dict[str, Any]], edges: list[dict[str, Any]]) -> dict[str, tuple[float, float]]:
    identifiers = [str(node["id"]) for node in nodes]
    node_by_id = {str(node["id"]): node for node in nodes}
    if all("x" in node and "y" in node for node in nodes):
        return {identifier: (float(node_by_id[identifier]["x"]), float(node_by_id[identifier]["y"])) for identifier in identifiers}
    outgoing: dict[str, list[str]] = defaultdict(list)
    degree = {identifier: 0 for identifier in identifiers}
    for edge in edges:
        source, target = str(edge["source"]), str(edge["target"])
        outgoing[source].append(target)
        degree[target] += 1
    queue = deque(identifier for identifier in identifiers if degree[identifier] == 0)
    order: list[str] = []
    while queue:
        current = queue.popleft()
        order.append(current)
        for target in outgoing[current]:
            degree[target] -= 1
            if degree[target] == 0:
                queue.append(target)
    if len(order) != len(identifiers):
        order = identifiers
        return {identifier: ((index % 4) / 3 if len(identifiers) > 1 else 0.5, 1 - (index // 4) * 0.32) for index, identifier in enumerate(order)}
    level = {identifier: 0 for identifier in identifiers}
    for source in order:
        for target in outgoing[source]:
            level[target] = max(level[target], level[source] + 1)
    lanes: dict[int, list[str]] = defaultdict(list)
    for identifier in identifiers:
        lanes[level[identifier]].append(identifier)
    maximum = max(level.values(), default=0)
    result: dict[str, tuple[float, float]] = {}
    for lane, identifiers_at_level in lanes.items():
        count = len(identifiers_at_level)
        for index, identifier in enumerate(identifiers_at_level):
            result[identifier] = (lane / maximum if maximum else 0.5, 1 - (index + 1) / (count + 1))
    return result


def flow_bounds(positions: dict[str, tuple[float, float]]) -> tuple[tuple[float, float], tuple[float, float]]:
    x_values = [position[0] for position in positions.values()]
    y_values = [position[1] for position in positions.values()]
    x_span = max(x_values) - min(x_values)
    y_span = max(y_values) - min(y_values)
    x_padding = max(0.14, x_span * 0.16)
    y_padding = max(0.14, y_span * 0.16)
    return (min(x_values) - x_padding, max(x_values) + x_padding), (min(y_values) - y_padding, max(y_values) + y_padding)


def render_flow(args: argparse.Namespace) -> None:
    if not args.nodes or not args.edges:
        fail("流程图需要 --nodes 和 --edges")
    nodes, edges = load_array(args.nodes), load_array(args.edges)
    require_columns(nodes, ["id", "label"])
    require_columns(edges, ["source", "target"])
    identifiers = [str(node["id"]) for node in nodes]
    if len(set(identifiers)) != len(identifiers):
        fail("流程图节点 id 必须唯一")
    known = set(identifiers)
    for edge in edges:
        if str(edge["source"]) not in known or str(edge["target"]) not in known:
            fail(f"边引用了不存在的节点：{edge}")
    positions = flow_positions(nodes, edges)
    x_bounds, y_bounds = flow_bounds(positions)
    groups = list(dict.fromkeys(str(node.get("group", "默认")) for node in nodes))
    group_colors = {group: COLORS[index % len(COLORS)] for index, group in enumerate(groups)}

    configure_matplotlib()
    fig, axis = plt.subplots(figsize=(11, max(5.8, len(nodes) * 0.8)))
    for edge in edges:
        sx, sy = positions[str(edge["source"])]
        tx, ty = positions[str(edge["target"])]
        arrow = patches.FancyArrowPatch((sx, sy), (tx, ty), arrowstyle="-|>", mutation_scale=15, linewidth=1.4, color="#7B8794", connectionstyle="arc3,rad=0.04")
        axis.add_patch(arrow)
        if edge.get("label"):
            axis.text((sx + tx) / 2, (sy + ty) / 2 + 0.035, str(edge["label"]), fontsize=8, color=MUTED_COLOR, ha="center")
    for node in nodes:
        identifier = str(node["id"])
        x, y = positions[identifier]
        group = str(node.get("group", "默认"))
        box = patches.FancyBboxPatch((x - 0.09, y - 0.055), 0.18, 0.11, boxstyle="round,pad=0.012", linewidth=1.2, edgecolor=group_colors[group], facecolor="#FFFFFF")
        axis.add_patch(box)
        axis.text(x, y, str(node["label"]), ha="center", va="center", fontsize=10, wrap=True)
    axis.set_title(args.title, loc="left", fontsize=16, fontweight="bold", pad=16)
    axis.set_xlim(*x_bounds)
    axis.set_ylim(*y_bounds)
    axis.axis("off")
    finish_static(fig, args)

def main() -> int:
    try:
        if "free-threading build" in sys.version:
            fail("当前 Python 是 free-threading build；此环境中的 Matplotlib 无法稳定写入 PNG。请改用常规 CPython（非 free-threading）后重试")
        args = parse_args()
        if args.type == "flow":
            render_flow(args)
        else:
            if not args.input:
                fail(f"{args.type} 图需要 --input")
            rows = load_array(args.input)
            if args.type == "line":
                render_line(args, rows)
            elif args.type == "bar":
                render_bar(args, rows)
            else:
                render_pie(args, rows)
        print(f"图片: {args.image.resolve()}")
        return 0
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"错误：{error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
