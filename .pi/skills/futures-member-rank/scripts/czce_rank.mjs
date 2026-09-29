#!/usr/bin/env node
/** Fetch and query the official CZCE daily member-ranking XLS workbook. */

import { writeFile } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";

const CZCE_PAGE_URL = "https://www.czce.com.cn/cn/jysj/jdcjpm/H077003006index_1.htm";
const STATIC_BASE_URL = "http://www.czce.com.cn/cn/DFSStaticFiles/Future";
const DATE_PATTERN = /^\d{8}$/;
const FREESECT = 0xffffffff;
const ENDOFCHAIN = 0xfffffffe;

function usage() {
	return `用法: node czce_rank.mjs [选项]

  --date latest|YYYYMMDD|YYYY-MM-DD  默认 latest（执行时的中国日期）
  --contract 标签                       精确匹配交易所表中的品种/合约标签
  --member 会员名称                     会员名称包含匹配
  --metric volume|long|short|all        默认 all
  --timeout 20                         单个 HTTP 请求超时秒数
  --format summary|table|json           标准输出格式
  --output data.json                   将全部抓取记录保存为 JSON`;
}

function parseArgs(argv) {
	const args = { date: "latest", contract: undefined, member: undefined, metric: "all", timeout: 20, format: undefined, output: undefined };
	const options = new Set(["date", "contract", "member", "metric", "timeout", "format", "output"]);
	for (let index = 0; index < argv.length; index += 1) {
		const token = argv[index];
		if (token === "--help" || token === "-h") {
			console.log(usage());
			process.exit(0);
		}
		if (!token.startsWith("--") || !options.has(token.slice(2))) throw new Error(`未知选项: ${token}`);
		const option = token.slice(2);
		const value = argv[index + 1];
		if (value === undefined || value.startsWith("--")) throw new Error(`--${option} 需要一个值`);
		index += 1;
		args[option] = option === "timeout" ? Number(value) : value;
	}
	if (!Number.isInteger(args.timeout) || args.timeout <= 0) {
		throw new Error("--timeout 必须为正整数");
	}
	if (!["volume", "long", "short", "all"].includes(args.metric)) throw new Error("--metric 必须是 volume、long、short 或 all");
	if (args.format && !["summary", "table", "json"].includes(args.format)) throw new Error("--format 必须是 summary、table 或 json");
	return args;
}

function parseDate(value) {
	const normalized = value.replaceAll("-", "");
	if (!DATE_PATTERN.test(normalized)) throw new Error("日期必须是 YYYYMMDD 或 YYYY-MM-DD");
	const year = Number(normalized.slice(0, 4));
	const month = Number(normalized.slice(4, 6));
	const day = Number(normalized.slice(6, 8));
	const result = new Date(Date.UTC(year, month - 1, day));
	if (result.getUTCFullYear() !== year || result.getUTCMonth() !== month - 1 || result.getUTCDate() !== day) throw new Error(`无效日期: ${value}`);
	return result;
}

function chinaToday() {
	const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
	const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
	return parseDate(`${values.year}${values.month}${values.day}`);
}

function ymd(value) {
	return `${value.getUTCFullYear()}${String(value.getUTCMonth() + 1).padStart(2, "0")}${String(value.getUTCDate()).padStart(2, "0")}`;
}

function urlFor(tradingDate, extension) {
	const dateText = ymd(tradingDate);
	return `${STATIC_BASE_URL}/${dateText.slice(0, 4)}/${dateText}/FutureDataHolding.${extension}`;
}

function u16(data, offset) {
	return new DataView(data.buffer, data.byteOffset, data.byteLength).getUint16(offset, true);
}

function u32(data, offset) {
	return new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(offset, true);
}

function f64(data, offset) {
	return new DataView(data.buffer, data.byteOffset, data.byteLength).getFloat64(offset, true);
}

function concatBytes(parts) {
	const length = parts.reduce((total, part) => total + part.length, 0);
	const result = new Uint8Array(length);
	let offset = 0;
	for (const part of parts) {
		result.set(part, offset);
		offset += part.length;
	}
	return result;
}

function decodeBiffString(data, offset, shortLength = false) {
	const length = shortLength ? data[offset] : u16(data, offset);
	let cursor = offset + (shortLength ? 1 : 2);
	const flags = data[cursor];
	cursor += 1;
	let richRuns = 0;
	let extensionSize = 0;
	if (flags & 0x08) {
		richRuns = u16(data, cursor);
		cursor += 2;
	}
	if (flags & 0x04) {
		extensionSize = u32(data, cursor);
		cursor += 4;
	}
	const bytes = length * (flags & 0x01 ? 2 : 1);
	const text = new TextDecoder(flags & 0x01 ? "utf-16le" : "latin1").decode(data.slice(cursor, cursor + bytes));
	return { text, next: cursor + bytes + richRuns * 4 + extensionSize };
}

class ChunkReader {
	constructor(chunks) {
		this.chunks = chunks;
		this.chunkIndex = 0;
		this.offset = 0;
	}

	advance() {
		while (this.chunkIndex < this.chunks.length && this.offset >= this.chunks[this.chunkIndex].length) {
			this.chunkIndex += 1;
			this.offset = 0;
		}
		if (this.chunkIndex >= this.chunks.length) throw new Error("XLS 共享字符串意外结束");
	}

	bytes(length) {
		const parts = [];
		let remaining = length;
		while (remaining > 0) {
			this.advance();
			const count = Math.min(remaining, this.chunks[this.chunkIndex].length - this.offset);
			parts.push(this.chunks[this.chunkIndex].slice(this.offset, this.offset + count));
			this.offset += count;
			remaining -= count;
		}
		return concatBytes(parts);
	}

	u8() {
		return this.bytes(1)[0];
	}

	u16() {
		return u16(this.bytes(2), 0);
	}

	u32() {
		return u32(this.bytes(4), 0);
	}

	characters(count, flags) {
		let remaining = count;
		let unicode = (flags & 0x01) !== 0;
		let value = "";
		while (remaining > 0) {
			if (this.offset >= this.chunks[this.chunkIndex].length) {
				this.chunkIndex += 1;
				this.offset = 0;
				if (this.chunkIndex >= this.chunks.length) throw new Error("XLS 共享字符串意外结束");
				unicode = (this.u8() & 0x01) !== 0;
			}
			const bytesPerCharacter = unicode ? 2 : 1;
			const available = Math.floor((this.chunks[this.chunkIndex].length - this.offset) / bytesPerCharacter);
			if (available === 0) throw new Error("XLS 共享字符串字符编码损坏");
			const take = Math.min(remaining, available);
			const byteLength = take * bytesPerCharacter;
			value += new TextDecoder(unicode ? "utf-16le" : "latin1").decode(
				this.chunks[this.chunkIndex].slice(this.offset, this.offset + byteLength),
			);
			this.offset += byteLength;
			remaining -= take;
		}
		return value;
	}
}

function parseSharedString(reader) {
	const length = reader.u16();
	const flags = reader.u8();
	const richRuns = flags & 0x08 ? reader.u16() : 0;
	const extensionSize = flags & 0x04 ? reader.u32() : 0;
	const value = reader.characters(length, flags);
	reader.bytes(richRuns * 4 + extensionSize);
	return value;
}

function parseOleWorkbook(file) {
	if (file.length < 512 || u32(file, 0) !== 0xe011cfd0 || u32(file, 4) !== 0xe11ab1a1) throw new Error("郑商所返回的不是 OLE XLS 文件");
	const sectorSize = 1 << u16(file, 30);
	const firstDirectorySector = u32(file, 48);
	const firstDifatSector = u32(file, 68);
	const difatSectorCount = u32(file, 72);
	const sector = (number) => file.slice((number + 1) * sectorSize, (number + 2) * sectorSize);
	const difat = [];
	for (let offset = 76; offset < 512; offset += 4) {
		const number = u32(file, offset);
		if (number !== FREESECT) difat.push(number);
	}
	let nextDifat = firstDifatSector;
	for (let count = 0; count < difatSectorCount && nextDifat !== ENDOFCHAIN; count += 1) {
		const contents = sector(nextDifat);
		for (let offset = 0; offset < sectorSize - 4; offset += 4) {
			const number = u32(contents, offset);
			if (number !== FREESECT) difat.push(number);
		}
		nextDifat = u32(contents, sectorSize - 4);
	}
	const fat = [];
	for (const fatSector of difat) {
		const contents = sector(fatSector);
		for (let offset = 0; offset < contents.length; offset += 4) fat.push(u32(contents, offset));
	}
	const chain = (start) => {
		const parts = [];
		let current = start;
		const seen = new Set();
		while (current !== ENDOFCHAIN && current !== FREESECT) {
			if (current >= fat.length || seen.has(current)) throw new Error("XLS 扇区链损坏");
			seen.add(current);
			parts.push(sector(current));
			current = fat[current];
		}
		return concatBytes(parts);
	};
	const directory = chain(firstDirectorySector);
	let workbookEntry;
	for (let offset = 0; offset + 128 <= directory.length; offset += 128) {
		const nameLength = u16(directory, offset + 64);
		const name = nameLength >= 2 ? new TextDecoder("utf-16le").decode(directory.slice(offset, offset + nameLength - 2)) : "";
		if ((name === "Workbook" || name === "Book") && directory[offset + 66] === 2) {
			workbookEntry = { start: u32(directory, offset + 116), size: u32(directory, offset + 120) };
			break;
		}
	}
	if (!workbookEntry) throw new Error("XLS 中未找到 Workbook 流");
	return chain(workbookEntry.start).slice(0, workbookEntry.size);
}

function parseBiff(workbook) {
	const records = [];
	for (let offset = 0; offset + 4 <= workbook.length; ) {
		const id = u16(workbook, offset);
		const size = u16(workbook, offset + 2);
		const payloadStart = offset + 4;
		if (payloadStart + size > workbook.length) throw new Error("XLS BIFF 记录越界");
		records.push({ id, offset, payload: workbook.slice(payloadStart, payloadStart + size) });
		offset = payloadStart + size;
	}
	const sharedStrings = [];
	const sstIndex = records.findIndex((record) => record.id === 0x00fc);
	if (sstIndex >= 0) {
		const chunks = [records[sstIndex].payload];
		for (let index = sstIndex + 1; index < records.length && records[index].id === 0x003c; index += 1) chunks.push(records[index].payload);
		const reader = new ChunkReader(chunks);
		reader.u32();
		const uniqueCount = reader.u32();
		for (let index = 0; index < uniqueCount; index += 1) {
			sharedStrings.push(parseSharedString(reader));
		}
	}
	const sheets = [];
	for (const record of records) {
		if (record.id !== 0x0085) continue;
		const name = decodeBiffString(record.payload, 6, true).text;
		sheets.push({ offset: u32(record.payload, 0), name });
	}
	if (sheets.length === 0) throw new Error("XLS 中未找到工作表");
	return { sharedStrings, sheets };
}

function parseRk(value) {
	let number;
	if (value & 0x02) number = value >> 2;
	else {
		const bytes = new Uint8Array(8);
		new DataView(bytes.buffer).setUint32(4, value & 0xfffffffc, true);
		number = new DataView(bytes.buffer).getFloat64(0, true);
	}
	return value & 0x01 ? number / 100 : number;
}

function parseSheet(workbook, start, sharedStrings) {
	const rows = new Map();
	const setCell = (row, column, value) => {
		if (!rows.has(row)) rows.set(row, new Map());
		rows.get(row).set(column, value);
	};
	for (let offset = start; offset + 4 <= workbook.length; ) {
		const id = u16(workbook, offset);
		const size = u16(workbook, offset + 2);
		const payloadStart = offset + 4;
		const payload = workbook.slice(payloadStart, payloadStart + size);
		if (id === 0x000a) break;
		if (id === 0x00fd) setCell(u16(payload, 0), u16(payload, 2), sharedStrings[u32(payload, 6)] ?? "");
		else if (id === 0x0203) setCell(u16(payload, 0), u16(payload, 2), f64(payload, 6));
		else if (id === 0x027e) setCell(u16(payload, 0), u16(payload, 2), parseRk(u32(payload, 6)));
		else if (id === 0x0204) setCell(u16(payload, 0), u16(payload, 2), decodeBiffString(payload, 6).text);
		else if (id === 0x00bd) {
			const row = u16(payload, 0);
			const firstColumn = u16(payload, 2);
			const lastColumn = u16(payload, payload.length - 2);
			for (let column = firstColumn; column <= lastColumn; column += 1) setCell(row, column, parseRk(u32(payload, 4 + (column - firstColumn) * 6 + 2)));
		}
		if (payloadStart + size > workbook.length) throw new Error("XLS 工作表记录越界");
		offset = payloadStart + size;
	}
	return [...rows.entries()]
		.sort(([left], [right]) => left - right)
		.map(([, cells]) => [...cells.entries()].sort(([left], [right]) => left - right).map(([, value]) => value));
}

function parseXls(file) {
	const workbook = parseOleWorkbook(file);
	const { sharedStrings, sheets } = parseBiff(workbook);
	return sheets.flatMap((sheet) => parseSheet(workbook, sheet.offset, sharedStrings));
}

// --- xlsx (OOXML) 解析 ---------------------------------------------------------

function parseZip(file) {
	if (file.length < 22) throw new Error("xlsx 文件过小");
	let endOffset = -1;
	for (let offset = file.length - 22; offset >= 0 && offset >= file.length - 22 - 65_536; offset -= 1) {
		if (u32(file, offset) === 0x06054b50) {
			endOffset = offset;
			break;
		}
	}
	if (endOffset < 0) throw new Error("xlsx 缺少 ZIP 结束记录");
	const entryCount = u16(file, endOffset + 10);
	const directoryOffset = u32(file, endOffset + 16);
	const entries = new Map();
	let cursor = directoryOffset;
	for (let index = 0; index < entryCount; index += 1) {
		if (u32(file, cursor) !== 0x02014b50) throw new Error("xlsx ZIP 中央目录损坏");
		const method = u16(file, cursor + 10);
		const compressedSize = u32(file, cursor + 20);
		const nameLength = u16(file, cursor + 28);
		const extraLength = u16(file, cursor + 30);
		const commentLength = u16(file, cursor + 32);
		const localOffset = u32(file, cursor + 42);
		const name = new TextDecoder("utf-8").decode(file.slice(cursor + 46, cursor + 46 + nameLength));
		entries.set(name, { method, compressedSize, localOffset });
		cursor += 46 + nameLength + extraLength + commentLength;
	}
	const read = (name) => {
		const entry = entries.get(name);
		if (!entry) throw new Error(`xlsx 缺少 ${name}`);
		if (u32(file, entry.localOffset) !== 0x04034b50) throw new Error(`xlsx ZIP local header 损坏: ${name}`);
		const nameLength = u16(file, entry.localOffset + 26);
		const extraLength = u16(file, entry.localOffset + 28);
		const dataStart = entry.localOffset + 30 + nameLength + extraLength;
		const compressed = file.slice(dataStart, dataStart + entry.compressedSize);
		if (entry.method === 0) return compressed;
		if (entry.method === 8) return inflateRawSync(compressed);
		throw new Error(`xlsx ZIP 不支持的压缩方法: ${entry.method}`);
	};
	return { entries, read };
}

function parseXml(source) {
	let position = 0;
	const length = source.length;

	function decodeEntities(value) {
		return value
			.replace(/&#x([0-9a-fA-F]+);/gu, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
			.replace(/&#(\d+);/gu, (_, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)))
			.replace(/&lt;/gu, "<")
			.replace(/&gt;/gu, ">")
			.replace(/&quot;/gu, '"')
			.replace(/&apos;/gu, "'")
			.replace(/&amp;/gu, "&");
	}

	function parseNode() {
		if (source[position] !== "<") {
			const end = source.indexOf("<", position);
			const text = decodeEntities(source.slice(position, end));
			position = end;
			return text;
		}
		position += 1;
		if (source.startsWith("!--", position)) {
			position = source.indexOf("-->", position) + 3;
			return null;
		}
		if (source.startsWith("![CDATA[", position)) {
			const end = source.indexOf("]]>", position);
			const text = source.slice(position + 9, end);
			position = end + 3;
			return text;
		}
		if (source[position] === "?" || source[position] === "!") {
			position = source.indexOf(">", position) + 1;
			return null;
		}
		const tagEnd = source.indexOf(">", position);
		let tag = source.slice(position, tagEnd);
		position = tagEnd + 1;
		const selfClosing = tag.endsWith("/");
		if (selfClosing) tag = tag.slice(0, -1);
		const spaceIndex = tag.search(/\s/u);
		const name = spaceIndex === -1 ? tag : tag.slice(0, spaceIndex);
		const attrs = {};
		if (spaceIndex !== -1) {
			const attrPattern = /([^\s=]+)\s*=\s*"([^"]*)"|([^\s=]+)\s*=\s*'([^']*)'/gu;
			let match;
			while ((match = attrPattern.exec(tag.slice(spaceIndex)))) {
				const key = match[1] ?? match[3];
				const value = match[2] ?? match[4] ?? "";
				attrs[key] = decodeEntities(value);
			}
		}
		const node = { name, attrs, children: [] };
		if (!selfClosing) {
			while (position < length) {
				if (source.startsWith(`</${name}`, position)) {
					position = source.indexOf(">", position) + 1;
					break;
				}
				const child = parseNode();
				if (child !== null) node.children.push(child);
			}
		}
		return node;
	}

	const children = [];
	while (position < length) {
		const child = parseNode();
		if (child !== null) children.push(child);
	}
	return { name: "#root", attrs: {}, children };
}

function elementChildren(node, name) {
	return node.children.filter((child) => typeof child !== "string" && child.name === name);
}

function firstElement(children, name) {
	return children.find((child) => typeof child !== "string" && child.name === name);
}

function textContent(node) {
	if (typeof node === "string") return node;
	return node.children.map(textContent).join("");
}

function columnIndex(reference) {
	const letters = reference.match(/[A-Z]+/u)?.[0] ?? "";
	let index = 0;
	for (const character of letters) index = index * 26 + (character.charCodeAt(0) - 64);
	return index - 1;
}

function parseSharedStringsXml(source) {
	const sst = firstElement(parseXml(source).children, "sst");
	return sst ? elementChildren(sst, "si").map(textContent) : [];
}

function parseWorksheetXml(source, sharedStrings) {
	const root = parseXml(source);
	const worksheet = firstElement(root.children, "worksheet");
	const sheetData = worksheet ? firstElement(worksheet.children, "sheetData") : undefined;
	if (!sheetData) return [];
	const rows = [];
	for (const rowNode of elementChildren(sheetData, "row")) {
		const cells = new Map();
		for (const cell of elementChildren(rowNode, "c")) {
			const column = columnIndex(cell.attrs.r ?? "");
			if (column < 0) continue;
			let value = "";
			if (cell.attrs.t === "inlineStr") {
				const inline = firstElement(cell.children, "is");
				value = inline ? textContent(inline) : "";
			} else {
				const valueNode = firstElement(cell.children, "v");
				const raw = valueNode ? textContent(valueNode) : "";
				value = cell.attrs.t === "s" ? (sharedStrings[Number(raw)] ?? "") : raw;
			}
			cells.set(column, value);
		}
		if (cells.size === 0) continue;
		const lastColumn = Math.max(...cells.keys());
		const row = [];
		for (let column = 0; column <= lastColumn; column += 1) row.push(cells.get(column) ?? "");
		rows.push(row);
	}
	return rows;
}

function parseXlsx(file) {
	const zip = parseZip(file);
	const sharedStrings = parseSharedStringsXml(new TextDecoder("utf-8").decode(zip.read("xl/sharedStrings.xml")));
	const names = [...zip.entries.keys()].filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/u.test(name)).sort();
	return names.flatMap((name) => parseWorksheetXml(new TextDecoder("utf-8").decode(zip.read(name)), sharedStrings));
}

function asInteger(value) {
	if (typeof value === "number" && Number.isSafeInteger(value)) return value;
	const result = Number(String(value).replaceAll(",", "").trim());
	if (!Number.isSafeInteger(result)) throw new Error(`无效数值: ${value}`);
	return result;
}

function text(row) {
	return row.map((cell) => String(cell ?? "").trim()).filter(Boolean).join(" ");
}

function instrumentFromTitle(value) {
	const match = value.match(/(?:品种|合约)[：:]\s*([^\s，,]+)/u);
	return match?.[1];
}

function recordsFromRows(rows, tradingDate) {
	const records = [];
	let instrument;
	for (const row of rows) {
		const rowText = text(row);
		const titleInstrument = instrumentFromTitle(rowText);
		if (titleInstrument) instrument = titleInstrument;
		if (!Number.isFinite(Number(row[0])) || row.length < 10 || !instrument) continue;
		let rank;
		try {
			rank = asInteger(row[0]);
		} catch {
			continue;
		}
		if (rank < 1 || rank > 20) continue;
		const metricCells = [
			["volume", row[1], row[2], row[3]],
			["long", row[4], row[5], row[6]],
			["short", row[7], row[8], row[9]],
		];
		for (const [metric, member, value, change] of metricCells) {
			if (!member) continue;
			try {
				records.push({ date: ymd(tradingDate), exchange: "CZCE", instrument, metric, rank, member: String(member).trim(), value: asInteger(value), change: asInteger(change) });
			} catch {
				// The row is not a member-rank row in the expected ten-column layout.
			}
		}
	}
	if (records.length === 0) throw new Error("未能从郑商所 XLS 识别会员排名表；可能是交易所格式已变更");
	return records;
}

async function fetchDay(tradingDate, timeout) {
	let lastError;
	let notFoundCount = 0;
	for (const extension of ["xlsx", "xls"]) {
		const url = urlFor(tradingDate, extension);
		try {
			const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; czce-member-rank/1.0)", Accept: "application/vnd.ms-excel,*/*" }, signal: AbortSignal.timeout(timeout * 1000) });
			if (!response.ok) {
				if (response.status === 404) notFoundCount += 1;
				throw new Error(`HTTP ${response.status}`);
			}
			const file = new Uint8Array(await response.arrayBuffer());
			const rows = file.length >= 4 && file[0] === 0x50 && file[1] === 0x4b ? parseXlsx(file) : parseXls(file);
			return { records: recordsFromRows(rows, tradingDate), url };
		} catch (error) {
			lastError = error;
		}
	}
	if (notFoundCount === 2) throw new Error(`${ymd(tradingDate)} 的郑商所排名文件尚未发布，可能尚未更新或为非交易日`);
	throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function filterRecords(records, args) {
	const member = args.member?.toLocaleLowerCase("zh-CN");
	const instrument = args.contract?.toLocaleUpperCase("zh-CN");
	return records
		.filter((record) => !member || record.member.toLocaleLowerCase("zh-CN").includes(member))
		.filter((record) => !instrument || record.instrument.toLocaleUpperCase("zh-CN") === instrument)
		.filter((record) => args.metric === "all" || record.metric === args.metric)
		.sort((left, right) => left.instrument.localeCompare(right.instrument) || left.metric.localeCompare(right.metric) || left.rank - right.rank);
}

function printTable(records) {
	if (records.length === 0) {
		console.log("没有匹配记录。该会员可能未进入指定表和指标的官方前 20 名。");
		return;
	}
	const columns = ["date", "exchange", "instrument", "metric", "rank", "member", "value", "change"];
	const headers = ["交易日", "交易所", "品种/合约", "指标", "名次", "会员", "数量", "变化"];
	const values = records.map((record) => columns.map((column) => String(record[column])));
	const widths = headers.map((header, index) => Math.max(header.length, ...values.map((row) => row[index].length)));
	console.log(headers.map((header, index) => header.padEnd(widths[index])).join("  "));
	console.log(widths.map((width) => "-".repeat(width)).join("  "));
	for (const row of values) console.log(row.map((value, index) => value.padEnd(widths[index])).join("  "));
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const tradingDate = args.date === "latest" ? chinaToday() : parseDate(args.date);
	const result = { tradingDate, ...(await fetchDay(tradingDate, args.timeout)) };
	const selectedRecords = filterRecords(result.records, args);
	const payload = { trade_date: ymd(result.tradingDate), exchange: "CZCE", source_page: CZCE_PAGE_URL, source_file: result.url, records: result.records };
	if (args.output) await writeFile(args.output, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
	const format = args.format ?? (args.member || args.contract || args.metric !== "all" ? "table" : "summary");
	if (format === "json") console.log(JSON.stringify({ ...payload, selected_records: selectedRecords }, null, 2));
	else if (format === "table") {
		console.log(`交易日: ${ymd(result.tradingDate)}（郑商所官方数据）`);
		printTable(selectedRecords);
	} else {
		console.log(`交易日: ${ymd(result.tradingDate)}`);
		console.log(`表标签数: ${new Set(result.records.map((record) => record.instrument)).size}；排名记录数: ${result.records.length}`);
		console.log(`来源: ${result.url}`);
	}
}

main().catch((error) => {
	console.error(`错误: ${error instanceof Error ? error.message : String(error)}`);
	if (process.env.CZCE_RANK_DEBUG === "1" && error instanceof Error) console.error(error.stack);
	process.exitCode = 2;
});
