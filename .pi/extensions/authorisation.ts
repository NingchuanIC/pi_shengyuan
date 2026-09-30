import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { Key, matchesKey } from "@earendil-works/pi-tui";

const MCP_ENDPOINT = "http://127.0.0.1:3000/mcp";
const SERVER_NAME = "shengyuan-trade-data";

function authorizationEndpoint(path: string) {
	return new URL(path, MCP_ENDPOINT).toString();
}

async function promptSecret(ctx: ExtensionCommandContext, title: string): Promise<string | undefined> {
	if (!ctx.hasUI) {
		ctx.ui.notify("/authorisation 需要交互式终端。", "error");
		return undefined;
	}

	return ctx.ui.custom<string | undefined>((tui, theme, _keybindings, done) => {
		let value = "";

		return {
			render: (width) => {
				const separator = "─".repeat(Math.max(1, width));
				return [
					theme.fg("accent", separator),
					theme.fg("text", title),
					`> ${"•".repeat(value.length)}`,
					theme.fg("dim", "Enter 确认 · Esc 取消 · 粘贴内容不会显示"),
					theme.fg("accent", separator),
				];
			},
			handleInput: (data) => {
				if (matchesKey(data, Key.escape)) {
					done(undefined);
					return;
				}
				if (matchesKey(data, Key.enter)) {
					done(value || undefined);
					return;
				}
				if (matchesKey(data, Key.backspace)) {
					value = value.slice(0, -1);
					tui.requestRender();
					return;
				}
				const pasted = /^\u001b\[200~([\s\S]*)\u001b\[201~$/.exec(data);
				const input = pasted?.[1] ?? data;
				if (input.startsWith("\u001b")) return;
				value += [...input].filter((character) => character >= " " && character !== "\u007f").join("");
				tui.requestRender();
			},
		};
	});
}

async function issueToken(role: "researcher" | "staff", issuerKey?: string): Promise<string> {
	const response = await fetch(authorizationEndpoint(role === "staff" ? "/auth/staff-token" : "/auth/token"), {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...(issuerKey ? { "X-Token-Issuer-Key": issuerKey } : {}),
		},
		body: role === "researcher" ? JSON.stringify({ role }) : undefined,
	});
	const payload: unknown = await response.json().catch(() => undefined);
	if (!response.ok || !payload || typeof payload !== "object" || typeof (payload as { access_token?: unknown }).access_token !== "string") {
		const message = payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
			? (payload as { error: string }).error
			: `HTTP ${response.status}`;
		throw new Error(`证书签发失败：${message}`);
	}
	return (payload as { access_token: string }).access_token;
}

async function storeBearerToken(ctx: ExtensionCommandContext, token: string): Promise<void> {
	const cliPath = join(ctx.cwd, ".pi", "npm", "node_modules", "pi-mcp-adapter", "cli.js");
	if (!existsSync(cliPath)) {
		throw new Error("未找到本地 pi-mcp-adapter。请先安装适配器。");
	}

	await new Promise<void>((resolve, reject) => {
		const child = spawn("node", [cliPath, "token", "set", SERVER_NAME], {
			cwd: ctx.cwd,
			stdio: ["pipe", "ignore", "pipe"],
		});
		let stderr = "";
		child.stderr.setEncoding("utf8");
		child.stderr.on("data", (chunk: string) => {
			stderr += chunk;
		});
		child.on("error", reject);
		child.on("close", (code) => {
			if (code === 0) resolve();
			else reject(new Error(stderr.trim() || "无法将证书写入系统凭据存储。"));
		});
		child.stdin.end(`${token}\n`);
	});
}

export default function authorisationExtension(pi: ExtensionAPI) {
	pi.registerCommand("authorisation", {
		description: "申请并保存本地交易数据访问证书",
		handler: async (args, ctx) => {
			if (args.trim()) {
				ctx.ui.notify("用法：/authorisation", "error");
				return;
			}
			const selected = await ctx.ui.select("选择授权角色", ["researcher", "staff"]);
			if (!selected) return;
			const role = selected as "researcher" | "staff";
			const issuerKey = role === "researcher" ? await promptSecret(ctx, "输入 researcher 身份令牌") : undefined;
			if (role === "researcher" && !issuerKey) return;

			try {
				const token = await issueToken(role, issuerKey);
				await storeBearerToken(ctx, token);
				ctx.ui.notify(`${role} 证书已保存，正在更新 MCP 可用工具。`, "info");
			} catch (error) {
				ctx.ui.notify(error instanceof Error ? error.message : "证书签发失败。", "error");
				return;
			}
			await ctx.reload();
		},
	});
}
