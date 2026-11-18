#!/usr/bin/env node
// Схема модулей игры: кто чьи имена использует.
//   node tools/modgraph.mjs            — печатает Mermaid-схему и таблицу зависимостей
//   node tools/modgraph.mjs --write    — обновляет блок между маркерами в docs/ARCHITECTURE.md
//   node tools/modgraph.mjs --json     — данные для тестов
// Имена — объявления верхнего уровня каждого файла (function/class/const/let/var вне блоков);
// ссылка — идентификатор в другом файле (не после точки и не ключ объекта). Комментарии и строки вырезаны.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src", "game");
const DOC = join(ROOT, "docs", "ARCHITECTURE.md");
const MIN_EDGE = 10; // ребро на схеме — от стольких ссылок; полная картина в таблице

// короткие подписи модулей для схемы
const LABEL = {
	"00_rand": "Rand",
	"01_head": "палитра, холст, спрайты",
	"05_err": "ошибки, аварийное окно",
	"10_core": "Events/Timers/Loop, частицы, свет",
	"12_state": "Machine (экраны)",
	"13_input": "Input",
	"15_ui": "кнопки, панели, шрифт",
	"20_data": "герои, реликвии, миры",
	"30_arena": "арена, навигация, погода",
	"40_fight": "бой: шаги, удары, боссы",
	"50_draw": "отрисовка боя и HUD",
	"60_game": "карта, события, лавка",
	"62_save": "сохранения",
	"65_screens": "экраны и таблица Machine.reg",
	"70_audio": "звук и музыка",
	"90_boot": "цикл кадра, запуск",
};

// вырезать комментарии, строки и шаблоны (содержимое заменяется пробелами, чтобы не ломать позиции строк)
function strip(src) {
	let out = "", i = 0;
	const n = src.length;
	while (i < n) {
		const c = src[i], d = src[i + 1];
		if (c === "/" && d === "/") { while (i < n && src[i] !== "\n") i++; continue; }
		if (c === "/" && d === "*") { const e = src.indexOf("*/", i + 2); const end = e < 0 ? n : e + 2; out += src.slice(i, end).replace(/[^\n]/g, " "); i = end; continue; }
		if (c === '"' || c === "'" || c === "`") {
			let j = i + 1;
			while (j < n && src[j] !== c) { if (src[j] === "\\") j++; if (c === "`" && src[j] === "$" && src[j + 1] === "{") { let depth = 1; j += 2; while (j < n && depth) { if (src[j] === "{") depth++; else if (src[j] === "}") depth--; j++; } continue; } j++; }
			out += c + src.slice(i + 1, j).replace(/[^\n]/g, " ") + c; i = j + 1; continue;
		}
		// регулярное выражение: после ( , = : [ ! & | ? { } ; return
		if (c === "/" && /[(,=:[!&|?{};\n]\s*$|return\s*$/.test(out.slice(-12))) {
			let j = i + 1, cls = false;
			while (j < n && src[j] !== "\n" && (cls || src[j] !== "/")) { if (src[j] === "\\") j++; else if (src[j] === "[") cls = true; else if (src[j] === "]") cls = false; j++; }
			out += "/" + " ".repeat(Math.max(0, j - i - 1)) + "/"; i = j + 1; continue;
		}
		out += c; i++;
	}
	return out;
}

// объявления верхнего уровня: имя → true
function declared(code) {
	const names = new Set();
	let depth = 0, i = 0;
	const n = code.length;
	const kw = /^(function\*?|class|const|let|var)\b/;
	while (i < n) {
		const c = code[i];
		if (c === "{" || c === "(" || c === "[") depth++;
		else if (c === "}" || c === ")" || c === "]") depth--;
		else if (depth === 0 && /[A-Za-z]/.test(c) && (i === 0 || !/[\w$.]/.test(code[i - 1]))) {
			const m = kw.exec(code.slice(i, i + 10));
			if (m) {
				const k = m[1];
				let j = i + k.length;
				if (k.startsWith("function") || k === "class") {
					const r = /\s*\*?\s*([A-Za-z_$][\w$]*)/y; r.lastIndex = j; const mm = r.exec(code);
					if (mm) names.add(mm[1]);
				} else {
					// список деклараторов до ';' на глубине 0: name = expr, name2, ...
					let d = 0, expectName = true;
					while (j < n) {
						const ch = code[j];
						if (ch === "{" || ch === "(" || ch === "[") d++;
						else if (ch === "}" || ch === ")" || ch === "]") d--;
						else if (d === 0 && ch === ";") break;
						else if (d === 0 && ch === ",") expectName = true;
						else if (d === 0 && expectName && /[A-Za-z_$]/.test(ch)) { const r2 = /[A-Za-z_$][\w$]*/y; r2.lastIndex = j; const mm = r2.exec(code); if (mm) { names.add(mm[0]); j = r2.lastIndex; expectName = false; continue; } }
						else if (d === 0 && ch === "=" && code[j + 1] !== "=" && code[j + 1] !== ">") expectName = false;
						j++;
					}
				}
				i += k.length;
				continue;
			}
		}
		i++;
	}
	return names;
}

// имена, объявленные внутри функций файла (локальные переменные, параметры): их вхождения не считаются —
// сканер не различает области видимости, а ложная стрелка хуже недосчитанной
function localNames(code, topLevel) {
	const loc = new Set();
	for (const m of code.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) if (!topLevel.has(m[1])) loc.add(m[1]);
	for (const m of code.matchAll(/\b(?:const|let|var)\s+[\[{]([^=]*)[\]}]\s*=/g)) for (const nm of m[1].match(/[A-Za-z_$][\w$]*/g) || []) loc.add(nm);
	for (const m of code.matchAll(/\bfunction\b[^(]*\(([^)]*)\)/g)) for (const nm of m[1].match(/[A-Za-z_$][\w$]*/g) || []) loc.add(nm);
	for (const m of code.matchAll(/\(([^()]*)\)\s*=>/g)) for (const nm of m[1].match(/[A-Za-z_$][\w$]*/g) || []) loc.add(nm);
	for (const m of code.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)\s*=>/g)) loc.add(m[1]);
	for (const m of code.matchAll(/\bcatch\s*\(\s*([A-Za-z_$][\w$]*)/g)) loc.add(m[1]);
	// методы объектов «name(params) {»: имя метода — не ссылка, параметры — локальные
	for (const m of code.matchAll(/(?<=[{,;}]\s*)(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(([^()]*)\)\s*\{/g)) { loc.add(m[1]); for (const nm of m[2].match(/[A-Za-z_$][\w$]*/g) || []) loc.add(nm); }
	for (const m of code.matchAll(/\bfor\s*\(\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) loc.add(m[1]);
	return loc;
}

export function analyze() {
	const files = readdirSync(SRC).filter((f) => f.endsWith(".js")).sort();
	const mods = files.map((f) => {
		const raw = readFileSync(join(SRC, f), "utf8"), code = strip(raw);
		const decl = declared(code);
		return { id: f.replace(/\.js$/, ""), lines: raw.split("\n").length - (raw.endsWith("\n") ? 1 : 0), code, decl, loc: localNames(code, decl) };
	});
	const owner = new Map();
	for (const m of mods) for (const nm of m.decl) if (!owner.has(nm)) owner.set(nm, m.id);
	const edges = {}; // from → { to → count }
	const names = {}; // from → to → [names]
	for (const m of mods) {
		edges[m.id] = {}; names[m.id] = {};
		const code = m.code;
		let mm;
		const re = /[A-Za-z_$][\w$]*/g;
		while ((mm = re.exec(code))) {
			const nm = mm[0];
			if (code[mm.index - 1] === ".") continue; // свойство
			// ключ объекта: «{ name:» или «, name:» (тернарный «? a : b» сюда не попадает)
			if (/^\s*:/.test(code.slice(re.lastIndex, re.lastIndex + 3)) && /[,{]\s*$/.test(code.slice(Math.max(0, mm.index - 40), mm.index))) continue;
			const to = owner.get(nm);
			if (!to || to === m.id || m.decl.has(nm) || m.loc.has(nm)) continue;
			edges[m.id][to] = (edges[m.id][to] || 0) + 1;
			(names[m.id][to] = names[m.id][to] || new Set()).add(nm);
		}
	}
	return { mods: mods.map(({ id, lines, decl }) => ({ id, lines, decl: decl.size })), edges, names: Object.fromEntries(Object.entries(names).map(([f, r]) => [f, Object.fromEntries(Object.entries(r).map(([t, s]) => [t, [...s].sort()]))])) };
}

export function mermaid(a) {
	const L = ["flowchart TB"];
	for (const m of a.mods) if (m.id !== "00_font") L.push(`    ${m.id}["${m.id}<br/><i>${LABEL[m.id] || ""}</i>"]`);
	for (const [from, row] of Object.entries(a.edges))
		for (const [to, n] of Object.entries(row).sort((x, y) => x[0].localeCompare(y[0])))
			if (n >= MIN_EDGE && from !== "00_font" && to !== "00_font") L.push(`    ${from} --> ${to}`);
	return L.join("\n");
}

export function table(a) {
	const rows = ["| модуль | строк | объявлений | использует имена из (число ссылок) |", "|---|---:|---:|---|"];
	for (const m of a.mods) {
		if (m.id === "00_font") continue;
		const deps = Object.entries(a.edges[m.id] || {}).sort((x, y) => y[1] - x[1]).map(([t, n]) => `${t} ${n}`).join(", ");
		rows.push(`| \`${m.id}\` | ${m.lines} | ${m.decl} | ${deps || "—"} |`);
	}
	return rows.join("\n");
}

// ссылки «вверх»: ранний файл использует имя, объявленное в более позднем (работает благодаря hoisting
// функций и тому, что функции ранних файлов вызываются уже после загрузки всего скрипта)
export function upward(a) {
	const order = a.mods.map((m) => m.id), out = [];
	for (const [from, row] of Object.entries(a.edges))
		for (const to of Object.keys(row).sort())
			if (order.indexOf(from) < order.indexOf(to)) out.push("`" + from + "` → `" + to + "`: " + a.names[from][to].map((n) => "`" + n + "`").join(", "));
	return out;
}

export function block(a) {
	return (
		"<!-- modgraph:start — блок порождается `npm run docs` (tools/modgraph.mjs); правки руками затрёт -->\n" +
		"Стрелка «A → B» — модуль A использует имена, объявленные в B (на схеме — от " + MIN_EDGE + " ссылок; все зависимости — в таблице ниже). " +
		"Все файлы — одна область видимости, поэтому поздний файл свободно пользуется ранними; стрелок «снизу вверх» (ранний файл → поздний) на схеме нет, а полный их список — ниже: это состояние и хуки, объявленные позже, но читаемые ранними функциями.\n\n" +
		"```mermaid\n" + mermaid(a) + "\n```\n\n" +
		"Ссылки ранних файлов на поздние (" + upward(a).length + "):\n\n" + upward(a).map((l) => "- " + l).join("\n") + "\n\n" +
		table(a) + "\n<!-- modgraph:end -->"
	);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
	const a = analyze();
	const args = process.argv.slice(2);
	if (args.includes("--json")) console.log(JSON.stringify(a));
	else if (args.includes("--write")) {
		const doc = readFileSync(DOC, "utf8");
		const re = /<!-- modgraph:start[^]*?<!-- modgraph:end -->/;
		if (!re.test(doc)) throw new Error("в docs/ARCHITECTURE.md нет маркеров modgraph");
		writeFileSync(DOC, doc.replace(re, () => block(a)));
		console.log("docs/ARCHITECTURE.md: схема модулей обновлена (" + a.mods.length + " файлов)");
	} else console.log(block(a));
}
