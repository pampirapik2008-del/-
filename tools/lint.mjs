#!/usr/bin/env node
// Статические проверки игрового кода (раздел 5.6 ТЗ):
//   - запрет прямого Math.random в src/game (вся случайность через Rand);
//   - запрет eval / new Function в игровом коде;
//   - запрет неявных глобалов: после запуска игры в обвязке в глобальной области
//     не должно появиться имён, кроме объявленных function/var/class верхнего уровня;
//   - длина функций: предупреждение > 120 строк (не ошибка — список в отчёте).
//   node tools/lint.mjs            — проверка, код выхода 1 при ошибках
//   node tools/lint.mjs --long     — только список длинных функций
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { boot, ROOT } from "../tests/harness/boot.mjs";

const SRC = path.join(ROOT, "src/game");
const LIMIT = 120;
const args = process.argv.slice(2);

const files = fs
	.readdirSync(SRC)
	.filter((f) => f.endsWith(".js"))
	.sort();

const errors = [];
const warnings = [];

/* ---------- запрещённые конструкции ---------- */
for (const f of files) {
	const text = fs.readFileSync(path.join(SRC, f), "utf8");
	const lines = text.split("\n");
	lines.forEach((ln, i) => {
		const code = ln.replace(/\/\/.*$/, "");
		if (/\bMath\.random\s*\(/.test(code)) errors.push(`${f}:${i + 1}: Math.random запрещён — используйте Rand`);
		if (/\beval\s*\(/.test(code)) errors.push(`${f}:${i + 1}: eval запрещён`);
		if (/\bnew\s+Function\s*\(/.test(code)) errors.push(`${f}:${i + 1}: new Function запрещён`);
		if (/\bdebugger\b/.test(code)) errors.push(`${f}:${i + 1}: debugger оставлен в коде`);
	});
}

/* ---------- длина функций (по объявлениям верхнего уровня и методам объектов) ---------- */
export function longFunctions(text, limit = LIMIT) {
	const lines = text.split("\n");
	const out = [];
	const re = /^(?:\t| {0,4})?(?:async\s+)?(?:function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>\s*\{|[A-Za-z_$][\w$]*\s*=>\s*\{)|([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{\s*$)/;
	for (let i = 0; i < lines.length; i++) {
		const m = re.exec(lines[i]);
		if (!m) continue;
		const name = m[1] || m[2] || m[3];
		if (!name || name === "if" || name === "for" || name === "while" || name === "switch" || name === "catch") continue;
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
	for (const fn of longFunctions(text)) warnings.push(`${f}:${fn.line}: функция ${fn.name} — ${fn.len} строк (лимит ${LIMIT})`);
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
