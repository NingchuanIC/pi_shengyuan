"""Check structured agent output contracts locally, without contacting BigQuant."""

import argparse
import json
import re
import sys
from pathlib import Path

from platform_io import extract_artifacts, find_agent, read_agents, read_context


def one_tag(text: str, tag: str) -> str:
    matches = re.findall(rf"<{tag}>(.*?)</{tag}>", text, re.DOTALL)
    if len(matches) != 1 or not matches[0].strip():
        raise ValueError(f"Expected one nonempty <{tag}> tag")
    return matches[0].strip()


def validate(agent: dict, text: str, context: dict, agents: list[dict]) -> None:
    agent_id = agent["id"]
    if agent_id == "RootRouter":
        result = json.loads(text)
        names = {item["id"] for item in agents if item["id"] != "RootRouter"}
        if not isinstance(result, dict) or set(result) != {"agent_name"} or result["agent_name"] not in names:
            raise ValueError("Router requires exactly one existing agent_name")
    elif agent_id == "StrategySearchAgent":
        result = json.loads(text)
        library = context.get("strategy_s")
        if not isinstance(library, list) or not library:
            raise ValueError("Validation requires a nonempty context.strategy_s array")
        known = [item["strategy_id"] for item in library if isinstance(item, dict) and "strategy_id" in item]
        if not isinstance(result, dict) or set(result) != {"strategy_id"}:
            raise ValueError("Search requires exactly the strategy_id key")
        ids = result["strategy_id"]
        if not isinstance(ids, list) or not ids:
            raise ValueError("strategy_id must be a nonempty array")
        if any(not isinstance(item, (str, int)) or isinstance(item, bool) for item in ids):
            raise ValueError("IDs must be strings or integers")
        if any(item not in known for item in ids) or len({json.dumps(item) for item in ids}) != len(ids):
            raise ValueError("IDs must exist in strategy_s and be unique")
    elif agent_id == "DemandPriceAgent":
        if not re.fullmatch(r"\s*<demand_title>[^<>]+</demand_title>\s*<demand_price>\d+</demand_price>\s*", text):
            raise ValueError("Price output must contain only title followed by integer price")
        title = one_tag(text, "demand_title")
        price = int(one_tag(text, "demand_price"))
        if len(title) > 10 or not 1499 <= price <= 5999:
            raise ValueError("Title must be <=10 characters and price must be 1499..5999")
    elif agent_id == "StockScreenerAgent":
        if "```" in text:
            raise ValueError("Stock screener forbids Markdown code fences")
        inner = one_tag(text, "stockscreener")
        sql = one_tag(inner, "stockscreenersql")
        if len(one_tag(inner, "stockstrategyname")) > 10:
            raise ValueError("Stock strategy name must be <=10 characters")
        if not re.search(r"<option>\s*\S[\s\S]*?</option>", inner):
            raise ValueError("At least one <option> is required")
        for column in ("date", "instrument", "name", "close", "total_market_cap"):
            if not re.search(rf"\b{column}\b", sql, re.IGNORECASE):
                raise ValueError(f"Missing required field: {column}")
        if not re.search(r"\bfloat_market_cap\s+AS\s+score\b", sql, re.IGNORECASE):
            raise ValueError("float_market_cap AS score is required")
    elif agent_id == "StrategyChatAgent":
        permitted = context.get("expose_strategy_code") is True and context.get("strategysource") != "community_discussion"
        if not permitted and re.search(r"<bigquantStrategy\b|```python", text):
            raise ValueError("Strategy code disclosure is disabled")
    elif agent_id == "CodeFixAgent":
        if text.strip().startswith("未发现明显错误"):
            return
        one_tag(text, "bigquantAIFix")
        if not re.search(r"```python\s*\n[\s\S]*?<bigquantAIFix>", text):
            raise ValueError("Fix code requires a Python Markdown code block")
    elif agent_id in ("StrategyCodeGenAgent", "StrategyCodeGenAgentV2", "FutureStrategyAgent", "OptionStrategyAgent", "QMTStrategyAgent"):
        artifacts = extract_artifacts(text)
        strategies = [item for item in artifacts if item["kind"] == "strategy"]
        if not strategies:
            raise ValueError("Strategy code must use <bigquantStrategy> tags")
        if agent_id == "StrategyCodeGenAgent" and "```" in text:
            raise ValueError("Visual strategy forbids Markdown code fences")
        for artifact in strategies:
            if agent_id in ("StrategyCodeGenAgent", "StrategyCodeGenAgentV2", "FutureStrategyAgent"):
                if not artifact.get("name") or len(artifact["name"]) > 10:
                    raise ValueError("A descriptive strategy name <=10 characters is required")
    else:
        raise ValueError("No strict machine-readable contract for this agent; review its SKILL.md")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("agent")
    parser.add_argument("input", type=Path)
    parser.add_argument("--context")
    args = parser.parse_args()
    try:
        agents = read_agents()
        agent = find_agent(agents, args.agent)
        validate(agent, args.input.read_text(encoding="utf-8-sig"), read_context(args.context), agents)
        print(json.dumps({"ok": True, "agent": agent["id"], "scope": "output-format-only"}))
        return 0
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(json.dumps({"ok": False, "error": str(error)}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
