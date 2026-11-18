#!/usr/bin/env node
// Горячие функции кадра: сколько собственного времени (self) и общего (incl) тратит каждая функция игры.
//   node tools/hot.mjs [--frames 900] [--seed 777] [--world 0 --depth 4] [--top 25] [--json] [--scenario fight|map]
// Как устроено: после прогрева все функции игры (объявления верхнего уровня + обработчики экранов из Machine.def)
// оборачиваются замером времени со стеком вызовов, поэтому self = incl − время вложенных обёрнутых вызовов.
// Накладные расходы обёртки калибруются на пустой функции и вычитаются (calls × ovh), поэтому у очень частых
// крошечных функций точность ниже. Canvas — заглушка: это JS-часть кода без растеризации (как в perf.mjs).
import { performance as hr } from "node:perf_hooks";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { boot } from "../tests/harness/boot.mjs";
import { createDom } from "../tests/harness/dom.mjs";

// заглушка окна даёт performance.now() = Date.now() (1 мс) — для замера функций нужны микросекунды
const bootHiRes = () => {
	const dom = createDom();
	dom.windowObj.performance.now = () => hr.now();
	return boot({ dom });
};

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "game");
const args = process.argv.slice(2);
const num = (k, d) => {
	const i = args.indexOf(k);
	return i >= 0 ? Number(args[i + 1]) : d;
};
const str = (k, d) => {
	const i = args.indexOf(k);
	return i >= 0 ? String(args[i + 1]) : d;
};
const FRAMES = num("--frames", 900),
	SEED = num("--seed", 777),
	WORLD = num("--world", 0),
	DEPTH = num("--depth", 4),
	TOP = num("--top", 25),
	SCENARIO = str("--scenario", "fight"),
	asJson = args.includes("--json");

// код профилировщика выполняется внутри игры (dev.run): там видны все объявления
const PROFILER = `
var __HOT = (() => {
	const acc = Object.create(null), st = [];
	const wrap = (name, f) => {
		const rec = (acc[name] = { calls: 0, incl: 0, self: 0 });
		const w = function () {
			const t0 = performance.now();
			st.push(0);
			rec.calls++;
			try {
				return new.target ? Reflect.construct(f, arguments, new.target) : f.apply(this, arguments);
			} finally {
				const dt = performance.now() - t0, child = st.pop();
				rec.incl += dt;
				rec.self += dt - child;
				if (st.length) st[st.length - 1] += dt;
			}
		};
		try { Object.defineProperty(w, "name", { value: name }); } catch (e) {}
		return w;
	};
	const map = new Map(); // оригинал → обёртка
	const isGameFn = (f) => {
		if (typeof f !== "function") return false;
		const s = Function.prototype.toString.call(f);
		return !/\\[native code\\]/.test(s) && !/^class[\\s{]/.test(s);
	};
	const G0 = this;
	// простой объект: прототип — null или Object.prototype (любой области: в обвязке Object подменён из Node)
	const isPlain = (v) => { if (!v || typeof v !== "object") return false; const p = Object.getPrototypeOf(v); return p === null || Object.getPrototypeOf(p) === null; };
	const install = (skip) => {
		let n = 0;
		for (const k of Object.getOwnPropertyNames(G0)) {
			if (skip.has(k) || k.startsWith("__")) continue;
			let d; try { d = Object.getOwnPropertyDescriptor(G0, k); } catch (e) { continue; }
			if (!d || !("value" in d) || !d.writable) continue;
			if (isGameFn(d.value)) {
				const w = wrap(k, d.value);
				map.set(d.value, w);
				G0[k] = w;
				n++;
			} else if (isPlain(d.value)) {
				// объекты-модули игры (Parts, Light, Rand, Machine…): методы — собственные свойства-функции
				const o = d.value;
				for (const m of Object.getOwnPropertyNames(o)) {
					const md = Object.getOwnPropertyDescriptor(o, m);
					if (!md || !("value" in md) || !md.writable || !isGameFn(md.value)) continue;
					const w = wrap(k + "." + m, md.value);
					map.set(md.value, w);
					o[m] = w;
					n++;
				}
			}
		}
		return n;
	};
	// объекты-модули, объявленные через const (Parts, Light, Fx, Rand…): они не свойства глобального объекта,
	// их имена собирает инструмент из исходников и передаёт сюда уже вычисленными
	const installConsts = (objs) => {
		let n = 0;
		for (const k in objs) {
			const o = objs[k];
			if (!isPlain(o)) continue;
			for (const m of Object.getOwnPropertyNames(o)) {
				const md = Object.getOwnPropertyDescriptor(o, m);
				if (!md || !("value" in md) || !md.writable || !isGameFn(md.value) || map.has(md.value)) continue;
				const w = wrap(k + "." + m, md.value);
				map.set(md.value, w);
				o[m] = w;
				n++;
			}
		}
		// обработчики экранов: ссылки на функции захвачены при регистрации, глобальная подмена их не достаёт
		for (const [scr, def] of Object.entries(Machine.def)) for (const h of ["enter", "update", "draw", "exit"]) {
			if (typeof def[h] !== "function") continue;
			def[h] = map.get(def[h]) || wrap(scr + "." + h, def[h]);
			n++;
		}
		return n;
	};
	// накладные расходы одной обёрнутой пустой функции
	const calibrate = () => {
		const f = wrap("__empty", function () {}), N = 300000;
		for (let i = 0; i < N; i++) f();
		const t0 = performance.now();
		for (let i = 0; i < N; i++) f();
		const per = (performance.now() - t0) / N;
		delete acc.__empty;
		return per;
	};
	const reset = () => { for (const k in acc) { acc[k].calls = 0; acc[k].incl = 0; acc[k].self = 0; } };
	const dump = () => JSON.stringify(acc);
	return { install, installConsts, calibrate, reset, dump, acc };
}).call(this);
__HOT`;

function scenario(g) {
	g.dev.seed(SEED);
	g.dev.newGame();
	for (let k = 0; k < 8; k++) g.dev.setSlot(k, null);
	for (let k = 0; k < 4; k++) g.dev.setSlot(k, g.dev.HEROES[k]);
	g.dev.setWorld(WORLD, DEPTH);
	if (SCENARIO === "map") {
		g.dev.S = "map";
		g.dev.bakeNow();
		g.step(30);
		return () => true;
	}
	g.dev.fight("fight");
	g.dev.startFight();
	g.step(120); // прогрев: JIT компилирует горячие функции на том же бою
	return () => g.dev.S === "fight";
}

const constNames = [...new Set(
	readdirSync(SRC).filter((f) => f.endsWith(".js")).flatMap((f) => [...readFileSync(join(SRC, f), "utf8").matchAll(/^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/gm)].map((m) => m[1])),
)];
const median = (xs) => { const a = xs.slice().sort((x, y) => x - y); return a.length ? a[a.length >> 1] : 0; };

// один прогон: опорный (без обёрток) или профилируемый; оба — тот же сценарий, те же случайные числа
async function runOnce(profiled) {
	const g = bootHiRes();
	if (!(await g.ready())) throw new Error("игра не загрузилась");
	g.step(5);
	const alive = scenario(g);
	let wrapped = 0, ovh = 0;
	if (profiled) {
		g.dev.run(PROFILER);
		wrapped = g.dev.run("__HOT.install(new Set(['requestAnimationFrame','setTimeout','clearTimeout','setInterval','clearInterval','performance','Reflect']))");
		// const-объекты верхнего уровня (функции-стрелки через const обернуть нельзя — их время уходит вызывающему)
		wrapped += g.dev.run("__HOT.installConsts({" + constNames.map((k) => k + ": (typeof " + k + " === 'object' && " + k + ") || null").join(", ") + "})");
		ovh = g.dev.run("__HOT.calibrate()");
		g.step(30); // прогрев обёрток
		g.dev.run("__HOT.reset()");
	}
	g.dev.instrument(true);
	const T = g.dev.timers, t0 = { upd: T.upd, draw: T.draw, n: T.n };
	let frames = 0;
	while (frames < FRAMES && alive()) {
		g.step(1);
		frames++;
	}
	const n = Math.max(1, T.n - t0.n);
	return { n, frameMs: (T.upd - t0.upd + T.draw - t0.draw) / n, wrapped, ovh, acc: profiled ? JSON.parse(g.dev.run("__HOT.dump()")) : null, errors: g.errors.length };
}

const RUNS = num("--runs", 3);
const bases = [], profs = [];
for (let r = 0; r < RUNS; r++) {
	bases.push(await runOnce(false));
	profs.push(await runOnce(true));
}
const pn = profs[0].n, wrapped = profs[0].wrapped;
const ovh = median(profs.map((p) => p.ovh));
const baseFrameMs = median(bases.map((b) => b.frameMs));
const profFrameMs = median(profs.map((p) => p.frameMs));
// по каждой функции — медиана по прогонам
const names = new Set(profs.flatMap((p) => Object.keys(p.acc)));
const rows = [...names]
	.map((name) => {
		const per = profs.map((p) => p.acc[name] || { calls: 0, incl: 0, self: 0 });
		const calls = median(per.map((r) => r.calls));
		if (!calls) return null;
		const self = median(per.map((r) => Math.max(0, r.self - r.calls * ovh))),
			incl = median(per.map((r) => Math.max(0, r.incl - r.calls * ovh)));
		return {
			name,
			calls,
			callsPerFrame: +(calls / pn).toFixed(2),
			selfUsPerFrame: +((self * 1000) / pn).toFixed(2),
			selfUsPerCall: +((self * 1000) / calls).toFixed(3),
			selfPct: +((self / Math.max(1e-9, profFrameMs * pn)) * 100).toFixed(1),
			inclUsPerFrame: +((incl * 1000) / pn).toFixed(2),
		};
	})
	.filter(Boolean)
	.sort((a, b) => b.selfUsPerFrame - a.selfUsPerFrame);
const totalSelf = rows.reduce((s, r) => s + r.selfUsPerFrame, 0);
const errorsTotal = bases.concat(profs).reduce((s, r) => s + r.errors, 0);

const out = {
	scenario: SCENARIO,
	seed: SEED,
	world: WORLD,
	depth: DEPTH,
	frames: pn,
	runs: RUNS,
	wrapped,
	overheadUsPerCall: +(ovh * 1000).toFixed(3),
	baseFrameMs: +baseFrameMs.toFixed(3),
	profiledFrameMs: +profFrameMs.toFixed(3),
	coveredPct: +((totalSelf / 1000 / profFrameMs) * 100).toFixed(1),
	errors: errorsTotal,
	top: rows.slice(0, TOP),
};
if (asJson) console.log(JSON.stringify(out));
else {
	console.log(
		`горячие функции: сценарий ${out.scenario}, seed ${SEED}, мир ${WORLD} глубина ${DEPTH}, кадров ${out.frames}, прогонов ${RUNS} (медианы), обёрнуто ${wrapped} функций`,
	);
	console.log(
		`кадр без обёрток ${out.baseFrameMs} мс, с обёртками ${out.profiledFrameMs} мс (накладные ≈ ${out.overheadUsPerCall} мкс/вызов, вычтены); учтено ${out.coveredPct} % времени кадра; ошибок ${out.errors}`,
	);
	const pad = (s, n, right) => (right ? String(s).padStart(n) : String(s).padEnd(n));
	console.log(pad("функция", 22) + pad("вызовов/кадр", 14, 1) + pad("self мкс/кадр", 15, 1) + pad("self %", 8, 1) + pad("мкс/вызов", 11, 1) + pad("incl мкс/кадр", 15, 1));
	for (const r of out.top)
		console.log(pad(r.name, 22) + pad(r.callsPerFrame, 14, 1) + pad(r.selfUsPerFrame, 15, 1) + pad(r.selfPct, 8, 1) + pad(r.selfUsPerCall, 11, 1) + pad(r.inclUsPerFrame, 15, 1));
}
process.exit(out.errors ? 1 : 0);
