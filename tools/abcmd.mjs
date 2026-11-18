#!/usr/bin/env node
// A/B по потоку команд холста: «эталон» (готовый HTML, по умолчанию index.html из HEAD) и текущие
// исходники проходят один и тот же сценарий на заглушке DOM. Каждый вызов метода и каждое
// присваивание свойства на ЛЮБОМ контексте 2d (главный холст и все оффскрины) пишется в журнал
// кадра; журналы сравниваются покадрово. Совпадение журналов означает одинаковые пиксели, причём
// проверяются не 35 статичных снимков, а ~11 000 кадров боёв, событий, лавки и арены.
// Нужен для рефакторинга отрисовки «без изменения картинки» (dFx/dFight/dMsg/dShop и т. п.).
//   node tools/abcmd.mjs [--ref path/to/game.html] [--cur path/to/game.html] [--seed 7] [--short]
// Код выхода 1 при расхождениях или ошибках консоли.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createDom } from "../tests/harness/dom.mjs";
import { recorder } from "../tests/harness/record.mjs";
import { boot, ROOT } from "../tests/harness/boot.mjs";

const args = process.argv.slice(2);
const opt = (f, d) => {
	const i = args.indexOf(f);
	return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const SEED = Number(opt("--seed", 7));
const SHORT = args.includes("--short");

function codeFromHtml(file) {
	const html = fs.readFileSync(file, "utf8");
	const part = (id) => {
		const m = html.match(new RegExp('<script type="text/plain" id="' + id + '">([\\s\\S]*?)</script>'));
		if (!m) throw new Error("в " + file + " нет секции " + id);
		return m[1];
	};
	return part("game-assets") + "\n" + part("game-src");
}
function refCode() {
	const file = opt("--ref", null);
	if (file) return codeFromHtml(file);
	const tmp = path.join(os.tmpdir(), "abcmd-head-" + process.pid + ".html");
	fs.writeFileSync(tmp, execFileSync("git", ["show", "HEAD:index.html"], { cwd: ROOT, maxBuffer: 64 << 20 }));
	try {
		return codeFromHtml(tmp);
	} finally {
		fs.unlinkSync(tmp);
	}
}

const mk = (code) => {
	const r = recorder();
	const dom = createDom({ canvasFactory: r.canvasFactory });
	return { g: boot({ dom, code }), log: r.log };
};
const A = mk(refCode()),
	B = mk(opt("--cur", null) ? codeFromHtml(opt("--cur", null)) : null);
if (!(await A.g.ready()) || !(await B.g.ready())) throw new Error("игра не загрузилась");

let frame = 0,
	bad = 0,
	cmds = 0,
	stage = "";
const same = (n) => {
	for (let i = 0; i < n; i++) {
		A.log.lines = [];
		B.log.lines = [];
		A.log.on = B.log.on = true;
		A.g.step(1);
		B.g.step(1);
		A.log.on = B.log.on = false;
		frame++;
		const a = A.log.lines,
			b = B.log.lines;
		cmds += a.length;
		let d = -1;
		for (let j = 0; j < a.length && j < b.length && d < 0; j++) if (a[j] !== b[j]) d = j;
		if (d < 0 && a.length !== b.length) d = Math.min(a.length, b.length);
		if (d >= 0) {
			bad++;
			if (bad <= 6) console.log(`РАСХОЖДЕНИЕ кадр ${frame} этап «${stage}» (команд ${a.length}/${b.length}) №${d}:\n  эталон: ${a[d]}\n  сейчас: ${b[d]}`);
		}
	}
};
const both = (f) => {
	f(A.g);
	f(B.g);
};
const k = SHORT ? 0.25 : 1;
const report = () => console.log(`  ${stage}: кадр ${frame}, S=${A.g.dev.S}/${B.g.dev.S}, расхождений ${bad}`);

both((g) => {
	g.step(5);
	g.dev.seed(SEED);
	g.dev.newGame();
	for (let i = 0; i < 4; i++) g.dev.setSlot(i, g.dev.HEROES[i]);
});
stage = "карта";
same(90 * k);
// боссы четырёх миров: расстановка кликом и автоматически, карточка врага, пауза-кнопка
for (const w of [0, 3, 6, 9]) {
	stage = "бой мир " + w;
	both((g) => {
		g.dev.S = "menu";
		g.dev.setWorld(w, 3);
		g.dev.fight("boss");
	});
	same(40 * k);
	both((g) => g.click(640, 400));
	same(20 * k);
	both((g) => g.dev.autoPlace());
	same(20 * k);
	both((g) => g.dev.startFight());
	same(60 * k);
	both((g) => g.click(900, 300));
	same(300 * k);
	both((g) => g.click(60, 60));
	same(900 * k);
	report();
}
// события: сундуки двух редкостей, выбор из трёх, тайник, простой текст
for (const [name, code] of [
	["сундук 5", "evChest(5)"],
	["сундук 0", "evChest(0)"],
	["племя", "evTribe()"],
	["тайник", "evSecret()"],
	["текст", 'msg("Привет\\nстрока")'],
]) {
	stage = "событие " + name;
	both((g) => {
		g.dev.S = "map";
		g.dev.run(code);
	});
	same(30 * k);
	both((g) => g.click(609, 300));
	same(90 * k);
	both((g) => g.click(609, 300));
	same(60 * k);
	both((g) => g.click(500, 290));
	same(30 * k);
	both((g) => g.click(609, 450));
	same(90 * k);
	report();
}
// лавка: выбор и покупка нескольких товаров
stage = "лавка";
both((g) => {
	g.dev.S = "map";
	g.dev.run("G.coin = 60");
	g.dev.openShop();
});
same(90 * k);
for (const [x, y] of [
	[430, 130],
	[430, 130],
	[600, 250],
	[600, 250],
	[1030, 370],
	[1030, 370],
	[430, 370],
	[160, 490],
]) {
	both((g) => g.click(x, y));
	same(45 * k);
}
report();
// другой отряд (молнии, стрелы, голем, тень) против боссов с «волной» — эффекты bolt и sweep
for (const w of [1, 5]) {
	stage = "бой мир " + w + " (volt/archer/golem/shade)";
	both((g) => {
		g.dev.S = "menu";
		["volt", "archer", "golem", "shade"].forEach((kk, i) => g.dev.setSlot(i, g.dev.HEROES.find((h) => h.k === kk)));
		g.dev.setWorld(w, 3);
		g.dev.fight("boss");
		g.dev.autoPlace();
		g.dev.startFight();
	});
	same(1500 * k);
	report();
}
stage = "арена";
both((g) => {
	g.dev.S = "menu";
	g.dev.run("G.arena = 1; G.wave = 2");
	g.dev.fight("arena");
	g.dev.autoPlace();
	g.dev.startFight();
});
same(600 * k);
report();
const errs = A.g.errors.length + B.g.errors.length;
console.log(`abcmd: кадров ${frame}, команд холста ${cmds}, расхождений ${bad}, ошибок консоли ${A.g.errors.length}/${B.g.errors.length}`);
process.exit(bad || errs ? 1 : 0);
