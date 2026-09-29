#!/usr/bin/env node
/**
 * Fetch and query official CFFEX member ranking CSV files.
 *
 * Each source row contains three independent official ranks: volume, long
 * open interest, and short open interest. This script normalizes them into
 * one record per metric so a member can be queried reliably.
 */

import { writeFile } from "node:fs/promises";

const BASE_URL = "http://www.cffex.com.cn/sj/ccpm";
const PRODUCTS = ["IF", "IH", "IC", "IM", "TS", "TF", "T", "TL"];
const METRICS = ["volume", "long", "short"];
const DATE_PATTERN = /^\d{8}$/;

function usage() {
	return `用法: node cffex_rank.mjs [选项]

  --date latest|YYYYMMDD|YYYY-MM-DD  默认 latest（执行时的中国日期）
  --products IF,IH,...                 默认全部中金所品种
  --contract IF2510                    精确合约代码
  --member 中信期货                     会员名称包含匹配
  --metric volume|long|short|all        默认 all
  --timeout 20                         单个 HTTP 请求超时秒数
  --format summary|table|json           标准输出格式
  --output data.json                   将全部抓取记录保存为 JSON`;
}

function parseProducts(value) {
	const products = [...new Set(value.split(",").map((item) => item.trim().toUpperCase()).filter(Boolean))];
	if (products.length === 0 || products.some((item) => !PRODUCTS.includes(item))) {
		throw new Error(`--products 只能是: ${PRODUCTS.join(", ")}`);
	}
	return products;
}

function parseArgs(argv) {
	const args = {
		date: "latest",
		products: PRODUCTS,
		contract: undefined,
		member: undefined,
		metric: "all",
		timeout: 20,
		format: undefined,
		output: undefined,
	};
	const valueOptions = new Set(["date", "products", "contract", "member", "metric", "timeout", "format", "output"]);
	for (let index = 0; index < argv.length; index += 1) {
		const token = argv[index];
		if (token === "--help" || token === "-h") {
			console.log(usage());
			process.exit(0);
		}
		if (!token.startsWith("--") || !valueOptions.has(token.slice(2))) {
			throw new Error(`未知选项: ${token}`);
		}
		const option = token.slice(2);
		const value = argv[index + 1];
		if (value === undefined || value.startsWith("--")) {
			throw new Error(`--${option} 需要一个值`);
		}
		index += 1;
		if (option === "products") args.products = parseProducts(value);
		else if (option === "timeout") args[option] = Number(value);
		else args[option] = value;
	}
	if (!Number.isInteger(args.timeout) || args.timeout <= 0) {
		throw new Error("--timeout 必须为正整数");
	}
	if (![...METRICS, "all"].includes(args.metric)) {
		throw new Error("--metric 必须是 volume、long、short 或 all");
	}
	if (args.format && !["summary", "table", "json"].includes(args.format)) {
		throw new Error("--format 必须是 summary、table 或 json");
	}
	return args;
}

function parseDate(value) {
	const normalized = value.replaceAll("-", "");
	if (!DATE_PATTERN.test(normalized)) throw new Error("日期必须是 YYYYMMDD 或 YYYY-MM-DD");
	const year = Number(normalized.slice(0, 4));
	const month = Number(normalized.slice(4, 6));
	const day = Number(normalized.slice(6, 8));
	const result = new Date(Date.UTC(year, month - 1, day));
	if (result.getUTCFullYear() !== year || result.getUTCMonth() !== month - 1 || result.getUTCDate() !== day) {
		throw new Error(`无效日期: ${value}`);
	}
	return result;
}

function chinaToday() {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Shanghai",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(new Date());
	const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
	return parseDate(`${byType.year}${byType.month}${byType.day}`);
}

function ymd(value) {
	return `${value.getUTCFullYear()}${String(value.getUTCMonth() + 1).padStart(2, "0")}${String(value.getUTCDate()).padStart(2, "0")}`;
}

function urlFor(tradingDate, product) {
	const dateText = ymd(tradingDate);
	return `${BASE_URL}/${dateText.slice(0, 6)}/${dateText.slice(6)}/${product}_1.csv`;
}

function parseCsvLine(line) {
	const cells = [];
	let cell = "";
	let quoted = false;
	for (let index = 0; index < line.length; index += 1) {
		const character = line[index];
		if (character === '"') {
			if (quoted && line[index + 1] === '"') {
				cell += '"';
				index += 1;
			} else {
				quoted = !quoted;
			}
		} else if (character === "," && !quoted) {
			cells.push(cell.trim());
			cell = "";
		} else {
			cell += character;
		}
	}
	if (quoted) throw new Error("CSV 引号未闭合");
	cells.push(cell.trim());
	return cells;
}

function asInteger(value) {
	const result = Number(value.replaceAll(",", "").trim());
	if (!Number.isSafeInteger(result)) throw new Error(`无效数值: ${value}`);
	return result;
}

function parseCsv(content, product, requestedDate) {
	const text = new TextDecoder("gb18030").decode(content).replace(/^\uFEFF/, "");
	if (/<html/i.test(text) || text.includes("网页错误")) throw new Error("交易所返回了错误页面，而不是 CSV 数据");
	const records = [];
	for (const line of text.split(/\r?\n/)) {
		if (!line.trim()) continue;
		const row = parseCsvLine(line);
		if (row.length < 12 || !DATE_PATTERN.test(row[0])) continue;
		if (row[0] !== ymd(requestedDate)) throw new Error(`文件交易日 ${row[0]} 与请求日期不一致`);
		const rank = asInteger(row[2]);
		const cells = [
			["volume", row[3], row[4], row[5]],
			["long", row[6], row[7], row[8]],
			["short", row[9], row[10], row[11]],
		];
		for (const [metric, member, value, change] of cells) {
			if (!member) continue;
			records.push({ date: row[0], product, contract: row[1], metric, rank, member, value: asInteger(value), change: asInteger(change) });
		}
	}
	if (records.length === 0) throw new Error("CSV 中没有可识别的排名记录");
	return records;
}

async function fetchProduct(tradingDate, product, timeout) {
	const url = urlFor(tradingDate, product);
	let response;
	try {
		response = await fetch(url, {
			headers: { "User-Agent": "Mozilla/5.0 (compatible; cffex-member-rank/1.0)", Accept: "text/csv,*/*" },
			signal: AbortSignal.timeout(timeout * 1000),
		});
	} catch (error) {
		throw new Error(`网络错误: ${error instanceof Error ? error.message : String(error)}`);
	}
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	return { records: parseCsv(await response.arrayBuffer(), product, tradingDate), url };
}

async function fetchDay(tradingDate, products, timeout) {
	const records = [];
	const failures = [];
	for (const product of products) {
		try {
			const result = await fetchProduct(tradingDate, product, timeout);
			records.push(...result.records);
		} catch (error) {
			failures.push({ product, url: urlFor(tradingDate, product), reason: error instanceof Error ? error.message : String(error) });
		}
	}
	return { records, failures };
}

function formatFailures(failures) {
	return failures.length === 0 ? "无详细错误" : failures.map((item) => `${item.product}: ${item.reason}`).join("; ");
}

function filterRecords(records, args) {
	const member = args.member?.toLocaleLowerCase("zh-CN");
	const contract = args.contract?.toUpperCase();
	return records
		.filter((record) => !member || record.member.toLocaleLowerCase("zh-CN").includes(member))
		.filter((record) => !contract || record.contract.toUpperCase() === contract)
		.filter((record) => args.metric === "all" || record.metric === args.metric)
		.sort((left, right) => left.product.localeCompare(right.product) || left.contract.localeCompare(right.contract) || left.metric.localeCompare(right.metric) || left.rank - right.rank);
}

function printTable(records) {
	if (records.length === 0) {
		console.log("没有匹配记录。该会员可能未进入指定合约和指标的官方前 20 名。");
		return;
	}
	const columns = ["date", "product", "contract", "metric", "rank", "member", "value", "change"];
	const headers = ["交易日", "品种", "合约", "指标", "名次", "会员", "数量", "变化"];
	const values = records.map((record) => columns.map((column) => String(record[column])));
	const widths = headers.map((header, index) => Math.max(header.length, ...values.map((row) => row[index].length)));
	console.log(headers.map((header, index) => header.padEnd(widths[index])).join("  "));
	console.log(widths.map((width) => "-".repeat(width)).join("  "));
	for (const row of values) console.log(row.map((value, index) => value.padEnd(widths[index])).join("  "));
}

function printSummary(tradingDate, records, failures) {
	const contracts = new Set(records.map((record) => record.contract));
	const counts = Object.fromEntries(PRODUCTS.map((product) => [product, new Set(records.filter((record) => record.product === product).map((record) => record.contract)).size]));
	console.log(`交易日: ${ymd(tradingDate)}`);
	console.log(`合约数: ${contracts.size}；排名记录数: ${records.length}`);
	console.log(`各品种合约数: ${Object.entries(counts).filter(([, count]) => count).map(([product, count]) => `${product}=${count}`).join(", ")}`);
	if (failures.length) console.error(`未获取品种: ${formatFailures(failures)}`);
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const tradingDate = args.date === "latest" ? chinaToday() : parseDate(args.date);
	const result = { tradingDate, ...(await fetchDay(tradingDate, args.products, args.timeout)) };
	if (result.records.length === 0) {
		const failureDetails = formatFailures(result.failures);
		const suffix = result.failures.length > 0 && result.failures.every((failure) => failure.reason === "HTTP 404")
			? "；数据可能尚未发布或为非交易日"
			: "";
		throw new Error(`${ymd(result.tradingDate)} 没有找到中金所官方数据: ${failureDetails}${suffix}`);
	}
	const selectedRecords = filterRecords(result.records, args);
	const payload = { trade_date: ymd(result.tradingDate), source: "CFFEX official member ranking CSV", records: result.records, failures: result.failures };
	if (args.output) await writeFile(args.output, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
	const format = args.format ?? (args.member || args.contract || args.metric !== "all" ? "table" : "summary");
	if (format === "json") console.log(JSON.stringify({ ...payload, selected_records: selectedRecords }, null, 2));
	else if (format === "table") {
		console.log(`交易日: ${ymd(result.tradingDate)}（中金所官方数据）`);
		printTable(selectedRecords);
		if (result.failures.length) console.error(`未获取品种: ${formatFailures(result.failures)}`);
	} else printSummary(result.tradingDate, result.records, result.failures);
}

main().catch((error) => {
	console.error(`错误: ${error instanceof Error ? error.message : String(error)}`);
	process.exitCode = 2;
});
