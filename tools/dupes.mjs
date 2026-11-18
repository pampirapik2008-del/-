#!/usr/bin/env node
// Поиск повторяющихся кусков кода в src/game (этап Q, «дубли логики»). Сравниваются окна из N
// подряд идущих содержательных строк после нормализации: убраны пробелы, комментарии, строковые
// и числовые литералы заменены на метки — так одинаковая логика с разными текстами и числами
// всё равно находится, а короткие похожие строки (`});`, `break;`) не дают ложных срабатываний,
// потому что окно должно совпасть целиком. Окна, вложенные в более длинный уже найденный повтор,
// не показываются. Это инструмент для глаз, а не ворота: часть повторов — осознанные (горячий код
// частиц, D27), их решает человек.
//   node tools/dupes.mjs             — повторы длиной ≥ 6 строк
//   node tools/dupes.mjs --min 10    — только длинные
//   node tools/dupes.mjs --json      — машинный вывод
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src/game");
const args = process.argv.slice(2);
const MIN = args.includes("--min") ? +args[args.indexOf("--min") + 1] : 6;
const JSON_OUT = args.includes("--json");

// нормализация строки: без комментариев и пробелов, литералы → метки; пустые и «служебные» строки пропускаем
const norm = (s) =>
	s
		.replace(/\/\/.*$/, "")
		.replace(/(["'`])(?:\\.|(?!\1).)*\1/g, "$")
		.replace(/\b\d+(\.\d+)?\b/g, "0")
		.replace(/\s+/g, "");
// данные (поля литералов объектов: `n:$,`, `foes:[$,$],`, `boss:{n:$,p1:[0,0]},`) — это таблицы, а не логика
const isData = (n) => /^[\w$]+:[^()=+\-*/<>!&|?.]*,?$/.test(n) || /^\[[$0,\[\]]*\],?$/.test(n) || /^\{[^()=]*\},?$/.test(n);
const trivial = (n) => n.length < 4 || /^[{}()\];,]*$/.test(n) || /^(break|continue|return|else|try|catch\(\w*\)|finally)[;{]*$/.test(n) || isData(n);

export function findDupes(files, min = MIN) {
	const lines = []; // { file, no, n } только содержательные
	for (const [file, text] of files) {
		let block = false;
		text.split("\n").forEach((raw, i) => {
			let s = raw;
			if (block) {
				const e = s.indexOf("*/");
				if (e < 0) return;
				s = s.slice(e + 2);
				block = false;
			}
			const b = s.indexOf("/*");
			if (b >= 0 && s.indexOf("*/", b) < 0) {
				block = true;
				s = s.slice(0, b);
			}
			const n = norm(s);
			if (!trivial(n)) lines.push({ file, no: i + 1, n });
		});
	}
	// хеш окна → первые позиции; затем расширяем совпадения жадно и выкидываем вложенные
	const key = (i) => lines.slice(i, i + min).map((l) => l.n).join("\n");
	const seen = new Map();
	const pairs = [];
	for (let i = 0; i + min <= lines.length; i++) {
		if (lines[i].file !== lines[i + min - 1].file) continue;
		const k = key(i);
		const prev = seen.get(k);
		if (prev === undefined) {
			seen.set(k, i);
			continue;
		}
		// расширяем вправо, пока строки совпадают и остаёмся в тех же файлах
		let len = min;
		while (i + len < lines.length && prev + len < i && lines[prev + len].n === lines[i + len].n && lines[prev + len].file === lines[prev].file && lines[i + len].file === lines[i].file) len++;
		pairs.push({ a: prev, b: i, len });
	}
	// вложенные (сдвиг на 1 внутри более длинного повтора) — убрать
	pairs.sort((p, q) => q.len - p.len);
	const kept = [];
	for (const p of pairs) if (!kept.some((q) => p.a >= q.a && p.a + p.len <= q.a + q.len && p.b >= q.b && p.b + p.len <= q.b + q.len)) kept.push(p);
	const at = (i) => path.basename(lines[i].file) + ":" + lines[i].no;
	return kept
		.map((p) => ({
			lines: p.len,
			a: at(p.a) + "–" + lines[p.a + p.len - 1].no,
			b: at(p.b) + "–" + lines[p.b + p.len - 1].no,
			sample: lines[p.a].n.slice(0, 70),
		}))
		.sort((x, y) => y.lines - x.lines || x.a.localeCompare(y.a));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const files = fs
		.readdirSync(SRC)
		.filter((f) => f.endsWith(".js"))
		.sort()
		.map((f) => [path.join(SRC, f), fs.readFileSync(path.join(SRC, f), "utf8")]);
	const d = findDupes(files, MIN);
	if (JSON_OUT) console.log(JSON.stringify(d, null, 1));
	else {
		for (const x of d) console.log(String(x.lines).padStart(3) + " строк  " + x.a.padEnd(26) + " = " + x.b.padEnd(26) + "  " + x.sample);
		console.log("dupes: повторов " + d.length + " (окно ≥ " + MIN + " содержательных строк), всего строк в повторах " + d.reduce((s, x) => s + x.lines, 0));
	}
}
