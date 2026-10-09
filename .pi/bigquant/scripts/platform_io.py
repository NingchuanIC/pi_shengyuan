"""Read local migration resources and extract source; never import platform SDKs."""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKILLS_ROOT = ROOT.parent / "skills"
TAG_PATTERN = re.compile(
    r"<(bigquantStrategy|bigquantAIFix|stockscreenersql)\b([^>]*)>(.*?)</\1>",
    re.DOTALL,
)
FENCE_PATTERN = re.compile(r"^```python[^\r\n]*\r?\n(.*?)^```\s*$", re.MULTILINE | re.DOTALL)


def read_agents() -> list[dict]:
    agents = json.loads((ROOT / "agents.json").read_text(encoding="utf-8"))
    if not isinstance(agents, list):
        raise ValueError("agents.json must be an array")
    for agent in agents:
        if not isinstance(agent, dict) or not isinstance(agent.get("id"), str):
            raise ValueError("Invalid agent record")
        if not isinstance(agent.get("skill"), str) or not re.fullmatch(
            r"[a-z0-9]+(?:-[a-z0-9]+)*", agent["skill"]
        ):
            raise ValueError("Invalid skill name")
        if not isinstance(agent.get("placeholders"), list):
            raise ValueError("Invalid placeholder list")
    return agents


def find_agent(agents: list[dict], name: str) -> dict:
    name = name.removeprefix("@").casefold()
    for agent in agents:
        if name in [item.casefold() for item in [agent["id"], agent["skill"], *agent["aliases"]]]:
            return agent
    raise ValueError(f"Unknown agent: {name}")


def read_context(filename: str | None) -> dict:
    if filename is None:
        return {}
    value = json.loads(Path(filename).read_text(encoding="utf-8-sig"))
    if not isinstance(value, dict):
        raise ValueError("Context JSON must be an object")
    return value


def resolve_context(agents: list[dict], context: dict) -> dict:
    return {
        **context,
        "agent_list": [
            {"agent_name": agent["id"], "description": agent["description"], "aliases": agent["aliases"]}
            for agent in agents if agent["id"] != "RootRouter"
        ],
    }


def render_source(agent: dict, context: dict) -> str:
    source = (SKILLS_ROOT / agent["skill"] / "references/source.md").read_text(encoding="utf-8-sig")
    # Explicit manifest keys prevent replacing Python __init__ or other dunder names.
    replacements = {}
    for key in agent["placeholders"]:
        value = context.get(key)
        if value is None or value == "" or value == []:
            raise ValueError(f"Missing context: {key}")
        replacements[f"__{key}__"] = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, indent=2)
    if not replacements:
        return source
    pattern = re.compile("|".join(re.escape(key) for key in replacements))
    return pattern.sub(lambda match: replacements[match.group()], source)


def extract_artifacts(text: str) -> list[dict]:
    artifacts = []
    for match in TAG_PATTERN.finditer(text):
        tag, attributes, code = match.groups()
        name = re.search(r"\bname\s*=\s*([\"'])(.*?)\1", attributes)
        code = re.sub(r"^\r?\n", "", code).rstrip()
        if not code.strip():
            raise ValueError(f"Empty {tag} artifact")
        artifact = {
            "kind": "sql" if tag == "stockscreenersql" else "fix" if tag == "bigquantAIFix" else "strategy",
            "language": "sql" if tag == "stockscreenersql" else "python",
            "code": code,
        }
        if name:
            artifact["name"] = name[2]
        artifacts.append(artifact)
    if not artifacts:
        for match in FENCE_PATTERN.finditer(text):
            code = match[1].rstrip()
            if code.strip():
                artifacts.append({"kind": "python", "language": "python", "code": code})
    if not artifacts:
        raise ValueError("No platform code tags or Python code blocks found")
    return artifacts
