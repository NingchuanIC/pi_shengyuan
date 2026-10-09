import { readFile } from "node:fs/promises";
import path from "node:path";
import { Type } from "@earendil-works/pi-ai";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	extractArtifacts,
	findAgent,
	loadAgent,
	readAgents,
	readContext,
	renderSource,
	resolveContext,
	skillsRoot,
} from "../../bigquant/runtime.ts";

/** Adapts exposed prompts to Pi; it does not invoke the proprietary agent runtime. */
export default function bigquantExtension(pi: ExtensionAPI): void {
	pi.registerTool(
		defineTool({
			name: "quant_agents",
			label: "Quant agent catalog",
			description: "List migrated BigQuant agents and their Pi skills. No platform calls.",
			parameters: Type.Object({}),
			async execute() {
				const agents = await readAgents();
				return { content: [{ type: "text", text: JSON.stringify(agents, null, 2) }], details: { agents } };
			},
		}),
	);
	pi.registerTool(
		defineTool({
			name: "quant_load_agent",
			label: "Load quant agent skill",
			description:
				"Load a BigQuant agent workflow and supplied context. Follow the skill and read relevant reference sections before generating code. Does not delegate or execute strategies.",
			parameters: Type.Object({
				agent: Type.String({ description: "Agent ID, skill name, or catalog alias" }),
				context_file: Type.Optional(Type.String({ description: "Context JSON path, relative to cwd or absolute" })),
			}),
			async execute(_id, params, _signal, _update, ctx) {
				const agents = await readAgents();
				const agent = findAgent(agents, params.agent);
				const context = resolveContext(agents, await readContext(ctx.cwd, params.context_file));
				const instructions = await loadAgent(agent, context);
				return { content: [{ type: "text", text: instructions }], details: { agent: agent.id } };
			},
		}),
	);
	pi.registerTool(
		defineTool({
			name: "quant_reference",
			label: "Read quant prompt reference",
			description:
				"Read a page of the original prompt, including API signatures and examples. For agents with placeholders, supply context first. Use the skill reference index to locate relevant lines.",
			parameters: Type.Object({
				agent: Type.String(),
				start_line: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
				line_count: Type.Optional(Type.Integer({ minimum: 1, maximum: 200, default: 100 })),
				context_file: Type.Optional(Type.String()),
			}),
			async execute(_id, params, _signal, _update, ctx) {
				const agents = await readAgents();
				const agent = findAgent(agents, params.agent);
				const source = await readFile(path.join(skillsRoot, agent.skill, "references/source.md"), "utf8");
				const context = resolveContext(agents, await readContext(ctx.cwd, params.context_file));
				const lines = source.split(/\r?\n/);
				const start = params.start_line ?? 1;
				const count = params.line_count ?? 100;
				const end = Math.min(start + count - 1, lines.length);
				if (start > lines.length) throw new Error(`start_line exceeds ${lines.length}`);
				const rawPage = lines.slice(start - 1, end).map((line, i) => `${start + i}: ${line}`).join("\n");
				const page = renderSource(rawPage, agent, context);
				return {
					content: [{ type: "text", text: `${agent.id}: lines ${start}-${end} of ${lines.length}\n${page}` }],
					details: { agent: agent.id, totalLines: lines.length, nextLine: end < lines.length ? end + 1 : null },
				};
			},
		}),
	);
	pi.registerTool(
		defineTool({
			name: "quant_extract_code",
			label: "Extract platform code",
			description:
				"Extract Python/SQL from platform output tags or Python Markdown fences. Returns code for writing to a file; does not execute or validate APIs.",
			parameters: Type.Object({ text: Type.String({ description: "Complete generated answer" }) }),
			async execute(_id, params) {
				const artifacts = extractArtifacts(params.text);
				return {
					content: [{ type: "text", text: JSON.stringify(artifacts, null, 2) }],
					details: { artifacts },
				};
			},
		}),
	);
	pi.registerCommand("quant", {
		description: "Usage: /quant <agent ID or alias> <request>; /quant list shows the catalog",
		handler: async (args, ctx) => {
			const agents = await readAgents();
			const match = /^(\S+)(?:\s+([\s\S]*))?$/.exec(args.trim());
			if (!match || match[1] === "list") {
				ctx.ui.notify(agents.map((agent) => `${agent.id}: ${agent.description}`).join("\n"), "info");
				return;
			}
			const agent = findAgent(agents, match[1]);
			if (!match[2]?.trim()) throw new Error("Usage: /quant <agent> <request>");
			const context = resolveContext(agents, await readContext(ctx.cwd));
			const skill = await loadAgent(agent, context);
			pi.sendUserMessage(`${skill}\n\n用户需求：\n${match[2]}`, { deliverAs: "followUp" });
		},
	});
}
