"""Render one exposed agent prompt with supplied context, without calling an LLM."""

import argparse
import os
import sys
from pathlib import Path

from platform_io import ROOT, SKILLS_ROOT, find_agent, read_agents, read_context, render_source, resolve_context


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("agent", help="Agent ID, skill name or alias")
    parser.add_argument("--context", default=os.environ.get("BIGQUANT_CONTEXT_FILE"))
    parser.add_argument("--output", type=Path, help="Write a prompt file; default is stdout")
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()
    try:
        agents = read_agents()
        agent = find_agent(agents, args.agent)
        context = resolve_context(agents, read_context(args.context))
        original = render_source(agent, context)
        skill = (SKILLS_ROOT / agent["skill"] / "SKILL.md").read_text(encoding="utf-8")
        skill = skill.split("---", 2)[2].strip()
        common = (ROOT / "common.md").read_text(encoding="utf-8")
        disclosure = ""
        if agent["id"] == "StrategyChatAgent":
            permitted = context.get("expose_strategy_code") is True and context.get("strategysource") != "community_discussion"
            disclosure = f"\n本次策略代码披露权限：{'允许' if permitted else '禁止'}。\n"
        prompt = (
            f"# 迁移执行指令（原参考有冲突时以这里的明确约定为准）\n\n{skill}\n\n{common}{disclosure}"
            f"\n\n# 原平台 prompt 参考（任务上下文已经填入）\n\n{original}\n"
        )
        if args.output:
            with args.output.open("w" if args.overwrite else "x", encoding="utf-8", newline="\n") as handle:
                handle.write(prompt)
            print(args.output.resolve())
        else:
            sys.stdout.write(prompt)
    except (OSError, ValueError, KeyError) as error:
        print(str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
