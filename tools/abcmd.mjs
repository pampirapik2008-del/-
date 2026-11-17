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

// Регистратор: заглушечные холсты, чьи контексты записывают каждую команду.
// Номера холстов и градиентов выдаются по порядку ПЕРВОГО ПОЯВЛЕНИЯ в журнале, а не создания —
// иначе лишний оффскрин при загрузке сдвигал бы все номера.
function recorder() {
	const log = { lines: [], on: false };
	let ids = 0,
		gids = 0;
	const calias = new Map(),
		galias = new Map();
	const al = (m, k) => {
		if (!m.has(k)) m.set(k, m.size + 1);
		return m.get(k);
	};
	const fmt = (v) => {
		if (v === null || v === undefined) return String(v);
		if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toPrecision(12);
		if (typeof v === "string" || typeof v === "boolean") return JSON.stringify(v);
		if (Array.isArray(v)) return "[" + v.map(fmt).join(",") + "]";
		if (v._cid) return "canvas#" + al(calias, v._cid);
		if (v._gid) return "grad#" + al(galias, v._gid);
		if (v.data && v.width) return "imgdata" + v.width + "x" + v.height;
		if (v.src !== undefined) return "img(" + String(v.src).slice(0, 24) + ")";
		return "obj";
	};
	// строка собирается лениво: номера-псевдонимы должны выдаваться только записанным командам
	const push = (f) => {
		if (log.on) log.lines.push(f());
	};
	const gradient = () => {
		const g = { _gid: ++gids, addColorStop: (o, c) => push(() => `grad#${al(galias, g._gid)}.stop(${fmt(o)},${fmt(c)})`) };
		return g;
	};
	const imgData = (w, h) => {
		w = Math.max(1, Math.round(w || 1));
		h = Math.max(1, Math.round(h || 1));
		return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
	};
	const makeCtx = (canvas) => {
		const base = {
			canvas,
			measureText: (t) => ({ width: String(t).length * 8 }),
			createLinearGradient: gradient,
			createRadialGradient: gradient,
			createConicGradient: gradient,
			createPattern: () => ({ _gid: ++gids }),
			getImageData: (x, y, w, h) => imgData(w, h),
			createImageData: (w, h) => imgData(w, h),
			getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
		};
		const state = {};
		const id = () => "c" + al(calias, canvas._cid);
		return new Proxy(base, {
			get(tgt, k) {
				if (k in tgt) {
					const v = tgt[k];
					if (typeof v === "function" && k !== "measureText" && k !== "getTransform")
						return (...a) => {
							push(() => `${id()}.${k}(${a.map(fmt).join(",")})`);
							return v.apply(tgt, a);
						};
					return v;
				}
				if (k in state) return state[k];
				return (...a) => push(() => `${id()}.${k}(${a.map(fmt).join(",")})`);
			},
			set(tgt, k, v) {
				state[k] = v;
				push(() => `${id()}.${k}=${fmt(v)}`);
				return true;
			},
		});
	};
	const canvasFactory = (w, h) => {
		const c = { _cid: ++ids, width: w || 300, height: h || 150, toDataURL: () => "data:," };
		let cx = null;
		c.getContext = () => cx || (cx = makeCtx(c));
		return c;
	};
	return { log, canvasFactory };
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
