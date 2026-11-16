#!/usr/bin/env node
// Fuzz сохранений: 1000 повреждённых вариантов не должны давать ни одного исключения
// и ни одного «мёртвого» экрана. Проверяются и основной слот, и резервный.
//   node tools/fuzz-saves.mjs [--n 1000]
import { boot } from "../tests/harness/boot.mjs";

const args = process.argv.slice(2);
const N = Number(args[args.indexOf("--n") + 1]) || 1000;
const SAVEK = "monsterAwakeningSave";
const SAVEK_B = SAVEK + ".bak";
const SCREENS = new Set(["menu", "pick", "map", "msg", "shop", "world", "prep", "fight", "win", "lose", "codex", "settings"]);

const g = boot();
if (!(await g.ready())) {
	console.error("игра не загрузилась");
	process.exit(1);
}
g.step(5);

// эталонное «нормальное» сохранение
g.dev.newGame();
g.dev.setSlot(0, g.dev.HEROES[0]);
g.dev.setSlot(1, g.dev.HEROES[1]);
g.dev.G.coin = 77;
g.dev.saveGame();
const rawValid = g.readStorage(SAVEK);
if (!rawValid) {
	console.error("не удалось получить эталонное сохранение");
	process.exit(1);
}

const rnd = (() => {
	let s = 0x1234567;
	return () => {
		s = (s * 1103515245 + 12345) & 0x7fffffff;
		return s / 0x7fffffff;
	};
})();
const pick = (a) => a[(rnd() * a.length) | 0];

function mutate(text) {
	const kind = (rnd() * 9) | 0;
	if (kind === 0) return text.slice(0, (rnd() * text.length) | 0); // обрезка
	if (kind === 1) {
		const i = (rnd() * text.length) | 0;
		return text.slice(0, i) + pick(['"', "{", "}", "[", "]", "0", "x", "\\", ","]) + text.slice(i + 1);
	}
	if (kind === 2) return text.replace(/"(\w+)":/g, (m, k) => (rnd() < 0.3 ? `"${k}":"строка",` : m));
	if (kind === 3) return text.replace(/-?\d+/g, () => pick(["0", "-1", "1e309", "-0.0001", "999999999999999999999"]));
	if (kind === 4) return JSON.stringify({ ...JSON.parse(text), extra: { a: 1 } });
	if (kind === 5) {
		const d = JSON.parse(text);
		d.sum = "00000000";
		return JSON.stringify(d);
	}
	if (kind === 6) {
		const d = JSON.parse(text);
		d.data = '{"N":null}';
		return JSON.stringify(d);
	}
	if (kind === 7) return JSON.stringify(JSON.parse(text).data ? { v: 3 } : {});
	return text + "мусор";
}

const weird = [
	"",
	"null",
	"undefined",
	"[]",
	"{}",
	"0",
	"-1",
	"1e309",
	'"строка"',
	'{"v":3}',
	'{"v":3,"data":null}',
	'{"v":3,"sum":"x","data":"{}"}',
	'{"v":2}',
	'{"v":99,"N":[],"E":[],"g":{}}',
	'{"v":2,"N":[{"x":1,"y":2}],"E":[],"g":{"slots":[]}}',
	'{"v":3,"data":"{\\"N\\":[{\\"x\\":0,\\"y\\":0}],\\"E\\":[[0,5]],\\"g\\":{\\"slots\\":[null]}}","sum":"00000000"}',
];

let crashes = 0;
let loads = 0;
let blank = 0;
const samples = [];

for (let i = 0; i < N; i++) {
	const bad = i < weird.length ? weird[i] : mutate(rawValid);
	try {
		g.setStorage(SAVEK, bad);
		g.setStorage(SAVEK_B, i % 3 === 0 ? rawValid : "");
		const before = g.dev.S;
		let ok = false;
		try {
			ok = g.dev.loadGame();
		} catch (e) {
			crashes++;
			if (samples.length < 6) samples.push({ kind: "throw", msg: String(e && e.message), save: bad.slice(0, 120) });
			continue;
		}
		if (ok) loads++;
		// игра должна остаться на валидном экране и кадр должен отрабатывать
		g.step(2);
		if (!SCREENS.has(g.dev.S)) {
			blank++;
			if (samples.length < 6) samples.push({ kind: "screen", screen: g.dev.S, save: bad.slice(0, 120) });
		}
		if (g.fatal) {
			crashes++;
			if (samples.length < 6) samples.push({ kind: "fatal", msg: String(g.fatal).slice(0, 160), save: bad.slice(0, 120) });
			g.clearFatal && g.clearFatal();
		}
		if (!ok && g.dev.S !== before && g.dev.S !== "map") {
			// неудачная загрузка не должна уводить игру с текущего экрана
			blank++;
			if (samples.length < 6) samples.push({ kind: "moved", from: before, to: g.dev.S, save: bad.slice(0, 120) });
		}
	} catch (e) {
		crashes++;
		if (samples.length < 6) samples.push({ kind: "outer", msg: String(e && e.message) });
	}
}

// отдельная проверка: битое основное + валидный резерв → восстанавливаемся
g.setStorage(SAVEK, '{"v":3,"sum":"deadbeef","data":"{}"}');
g.setStorage(SAVEK_B, rawValid);
const restored = g.dev.loadGame();
g.step(2);

console.log(`fuzz: ${N} сохранений, успешных загрузок ${loads}, исключений ${crashes}, «мёртвых» экранов ${blank}`);
console.log(`резерв: ${restored ? "восстановлено из резерва" : "НЕ восстановлено"}`);
if (samples.length) console.log("примеры:", JSON.stringify(samples, null, 1));
if (g.errors.length) console.log("предупреждения игры:", g.errors.slice(0, 5));
process.exit(crashes || blank || !restored ? 1 : 0);
