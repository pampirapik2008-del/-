#!/usr/bin/env node
// Статические проверки игрового кода (раздел 5.6 ТЗ):
//   - запрет прямого Math.random в src/game (вся случайность через Rand);
//   - запрет сравнений/присваиваний S вне 12_state.js (экран — только через Machine.is/flag/go);
//   - запрет eval / new Function в игровом коде;
//   - запрет неявных глобалов: после запуска игры в обвязке в глобальной области
//     не должно появиться имён, кроме объявленных function/var/class верхнего уровня;
//   - длина функций: ошибка > 80 строк (жёсткий предел), предупреждение > 60 (цель);
//     модуль-замыкание `const X = (() => { … })()` — пространство имён, а не функция:
//     его не меряем целиком, а проверяем функции внутри него;
//   - мёртвый код: объявление верхнего уровня в src/game, на которое нет ни одной
//     ссылки (кроме комментариев) ни в игре, ни в обвязке тестов, — ошибка.
//   node tools/lint.mjs            — проверка, код выхода 1 при ошибках
//   node tools/lint.mjs --long     — только список длинных функций
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { boot, ROOT } from "../tests/harness/boot.mjs";

const SRC = path.join(ROOT, "src/game");
const LIMIT = 80; // жёсткий предел длины функции (ошибка)
const SOFT = 60; // цель (предупреждение)
const STATE_FILE = "12_state.js"; // единственный файл, где разрешены S === "…" и S = "…"
const args = process.argv.slice(2);

const files = fs
	.readdirSync(SRC)
	.filter((f) => f.endsWith(".js"))
	.sort();

const errors = [];
const warnings = [];

/* ---------- запрещённые конструкции ---------- */
// список нарушений в одном файле: [{line, msg}]
export function forbidden(f, text) {
	const out = [];
	text.split("\n").forEach((ln, i) => {
		const code = ln.replace(/\/\/.*$/, "");
		const bad = (msg) => out.push({ line: i + 1, msg });
		if (/\bMath\.random\s*\(/.test(code)) bad("Math.random запрещён — используйте Rand");
		// экран спрашивают и меняют только через машину состояний (12_state.js): Machine.is/flag/go
		if (f !== STATE_FILE && /(?<![\w$.])S\s*(===|!==|==|!=)\s*["']/.test(code)) bad(`сравнение S с именем экрана вне ${STATE_FILE} — используйте Machine.is(...)`);
		if (f !== STATE_FILE && /(?<![\w$.])S\s*=\s*["']/.test(code)) bad(`присваивание S вне ${STATE_FILE} — используйте Machine.go(...)`);
		if (/\beval\s*\(/.test(code)) bad("eval запрещён");
		if (/\bnew\s+Function\s*\(/.test(code)) bad("new Function запрещён");
		if (/\bdebugger\b/.test(code)) bad("debugger оставлен в коде");
	});
	return out;
}
for (const f of files) {
	const text = fs.readFileSync(path.join(SRC, f), "utf8");
	for (const b of forbidden(f, text)) errors.push(`${f}:${b.line}: ${b.msg}`);
}

/* ---------- длина функций (по объявлениям верхнего уровня и методам объектов) ---------- */
export function longFunctions(text, limit = SOFT) {
	const lines = text.split("\n");
	const out = [];
	const re = /^(?:\t| {0,4})?(?:async\s+)?(?:function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>\s*\{|[A-Za-z_$][\w$]*\s*=>\s*\{)|([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{\s*$)/;
	for (let i = 0; i < lines.length; i++) {
		const m = re.exec(lines[i]);
		if (!m) continue;
		const name = m[1] || m[2] || m[3];
		if (!name || name === "if" || name === "for" || name === "while" || name === "switch" || name === "catch") continue;
		// модуль-замыкание: внутрь заходим и меряем его функции по отдельности
		if (/=\s*\(\s*(?:async\s*)?(?:\(\)\s*=>|function\b)/.test(lines[i])) continue;
		// считаем фигурные скобки до закрытия тела (строки и комментарии грубо игнорируем)
		let depth = 0,
			started = false,
			j = i;
		for (; j < lines.length; j++) {
			const s = lines[j].replace(/\/\/.*$/, "").replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g, '""');
			for (const ch of s) {
				if (ch === "{") {
					depth++;
					started = true;
				} else if (ch === "}") depth--;
			}
			if (started && depth <= 0) break;
		}
		const len = j - i + 1;
		if (len > limit) out.push({ name, line: i + 1, len });
		if (started && j > i) i = Math.max(i, j - 1);
	}
	return out;
}

for (const f of files) {
	const text = fs.readFileSync(path.join(SRC, f), "utf8");
	for (const fn of longFunctions(text)) (fn.len > LIMIT ? errors : warnings).push(`${f}:${fn.line}: функция ${fn.name} — ${fn.len} строк (${fn.len > LIMIT ? "предел " + LIMIT : "цель " + SOFT})`);
}

/* ---------- мёртвый код: объявления верхнего уровня без единой ссылки ---------- */
// Ссылкой считается любое вхождение имени вне комментариев в src/game или в обвязке
// (devapi/boot открывают функции тестам и инструментам). Имена с префиксом __ — рычаги обвязки.
export function deadDeclarations(texts, extraText = "") {
	const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
	const all = strip(texts.map((x) => x.text).join("\n")) + "\n" + strip(extraText);
	const out = [];
	for (const { file, text } of texts) {
		text.split("\n").forEach((ln, i) => {
			const m = /^(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/.exec(ln) || /^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\b/.exec(ln) || /^class\s+([A-Za-z_$][\w$]*)\b/.exec(ln);
			if (!m || m[1].startsWith("__")) return;
			const re = new RegExp("(?<![\\w$.])" + m[1].replace(/\$/g, "\\$") + "(?![\\w$])", "g");
			if ((all.match(re) || []).length <= 1) out.push({ name: m[1], file, line: i + 1 });
		});
	}
	return out;
}

{
	const texts = files.map((f) => ({ file: f, text: fs.readFileSync(path.join(SRC, f), "utf8") }));
	const extra = ["tests/harness/devapi.js", "tests/harness/boot.mjs"].map((p) => fs.readFileSync(path.join(ROOT, p), "utf8")).join("\n");
	for (const d of deadDeclarations(texts, extra)) errors.push(`${d.file}:${d.line}: мёртвый код — ${d.name} нигде не используется`);
}

/* ---------- неявные глобалы ---------- */
async function implicitGlobals() {
	const declared = new Set();
	for (const f of files) {
		const text = fs.readFileSync(path.join(SRC, f), "utf8");
		for (const m of text.matchAll(/^(?:async\s+)?(?:function\s*\*?\s*|class\s+|var\s+)([A-Za-z_$][\w$]*)/gm)) declared.add(m[1]);
	}
	const g = boot();
	if (!(await g.ready(8000))) throw new Error("игра не загрузилась");
	g.dev.seed(7);
	g.step(30);
	// короткий тур: новая игра → карта → бой, чтобы отработали основные ветки
	g.dev.newGame();
	g.step(5);
	g.dev.fight("norm");
	g.dev.startFight();
	g.step(240);
	const extra = g.newGlobals().filter((k) => !declared.has(k) && !k.startsWith("__"));
	return extra;
}

async function main() {
	if (args.includes("--long")) {
		for (const w of warnings) console.log(w);
		return 0;
	}
	let implicit = [];
	try {
		implicit = await implicitGlobals();
	} catch (e) {
		errors.push("проверка глобалов не выполнена: " + (e && e.message));
	}
	for (const k of implicit) errors.push(`неявный глобал: ${k} (присваивание без объявления)`);
	for (const w of warnings) console.log("предупреждение: " + w);
	for (const e of errors) console.log("ошибка: " + e);
	console.log(`lint: ошибок ${errors.length}, предупреждений ${warnings.length} (длинных функций), файлов ${files.length}`);
	return errors.length ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
	main()
		.then((c) => process.exit(c))
		.catch((e) => {
			console.error("FAIL:", e && e.stack ? e.stack : e);
			process.exit(1);
		});
}
