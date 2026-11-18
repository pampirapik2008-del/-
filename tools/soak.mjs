#!/usr/bin/env node
// Soak-тест: бот сам проходит игру, пока не наберётся заданное игровое время.
// Следим за ошибками консоли, NaN в состоянии, «залипаниями» экранов и ростом кучи.
//   node --expose-gc tools/soak.mjs [--minutes 30] [--seed 7] [--bake-ms 0.5] [--heap-snapshots DIR]
import fs from "node:fs";
import path from "node:path";
import v8 from "node:v8";
import { boot } from "../tests/harness/boot.mjs";

const args = process.argv.slice(2);
const num = (f, d) => {
	const i = args.indexOf(f);
	return i >= 0 && args[i + 1] ? Number(args[i + 1]) : d;
};
const MINUTES = num("--minutes", 30);
const SEED = num("--seed", 7);
const BAKE_MS = num("--bake-ms", 0); // >0 — собирать фон карты порциями, как в браузере (проверка экрана загрузки)
const SNAPDIR = (() => {
	const i = args.indexOf("--heap-snapshots");
	return i >= 0 && args[i + 1] ? args[i + 1] : null;
})(); // каталог для двух снимков кучи (после прогрева и в конце) — разбирать tools/heapdiff.mjs
const MAX_FRAMES = Math.round(MINUTES * 60 * 60); // 60 кадров в секунду

// собственный детерминированный генератор бота (в игру не попадает)
let rs = (SEED * 2654435761) >>> 0;
const rnd = () => {
	rs = (rs + 0x6d2b79f5) >>> 0;
	let q = Math.imul(rs ^ (rs >>> 15), 1 | rs);
	q = (q + Math.imul(q ^ (q >>> 7), 61 | q)) ^ q;
	return ((q ^ (q >>> 14)) >>> 0) / 4294967296;
};
const pickIdx = (n) => (rnd() * n) | 0;

const heap = () => {
	if (global.gc) global.gc();
	return process.memoryUsage().heapUsed / 1048576;
};
// только данные (new/old/large object space): без code/trusted space, куда V8 складывает машинный код,
// байткод и обратную связь JIT — они растут весь прогон независимо от игры
const DATA_SPACES = new Set(["new_space", "old_space", "large_object_space", "new_large_object_space"]);
const heapData = () => v8.getHeapSpaceStatistics().reduce((n, sp) => n + (DATA_SPACES.has(sp.space_name) ? sp.space_used_size : 0), 0) / 1048576;
const dataSamples = [];
const snapshot = (name) => {
	if (global.gc) global.gc();
	fs.mkdirSync(SNAPDIR, { recursive: true });
	v8.writeHeapSnapshot(path.join(SNAPDIR, name + ".heapsnapshot"));
};

const g = boot(BAKE_MS > 0 ? { bakeMs: BAKE_MS } : {});
if (!(await g.ready())) {
	console.error("игра не загрузилась");
	process.exit(1);
}
g.step(10);
g.dev.labelButtons(); // подписи кнопок — чтобы ходить по тексту, а не по индексу

// размеры кэшей и подписок: по ним видно, что именно растёт, если растёт куча
const sizes = () =>
	JSON.parse(
		g.dev.run(
			'JSON.stringify({ ...cacheStats(), ev: Object.values(Events.h).reduce((n, a) => n + a.length, 0), timers: Timers.list.length, bts: Object.keys(BTS).length, cnt: Object.keys(CNT).length, errs: ERRS.length, parts: Parts.n === undefined ? -1 : Parts.n })'
		)
	);
const sizes0 = sizes();
const heap0 = heap();
const heapSamples = []; // снимаем по ходу: первые проценты роста — это прогрев кэшей и JIT, а не утечка

// меню → выбор героя
for (let i = 0; i < 8 && g.dev.S === "menu"; i++) {
	g.clickHit((g.dev.hits || [])[i]);
	g.step(4);
}
g.step(10);
if (g.dev.S === "pick") {
	const h = (g.dev.hits || [])[0];
	g.clickHit(h);
	g.step(6);
	g.clickHit(h);
	g.step(10);
}

let nan = 0,
	stuck = 0,
	states = 0,
	lastS = null,
	sameFor = 0;
const seen = new Map(),
	stuckBy = {};

for (let f = 0; f < MAX_FRAMES; f++) {
	g.step(1);
	if (f % 3 !== 0) continue;
	const S = g.dev.S;
	if (S !== lastS) {
		states++;
		seen.set(S, (seen.get(S) || 0) + 1);
		lastS = S;
		sameFor = 0;
	} else sameFor += 3;
	if (f % 60 === 0) {
		const snap = g.dev.snapshot();
		if (snap.includes("NaN") || snap.includes("Infinity")) nan++;
	}
	if (f > 0 && f % Math.max(600, Math.round(MAX_FRAMES / 10)) === 0) {
		heapSamples.push(heap());
		dataSamples.push(heapData());
		if (SNAPDIR && heapSamples.length === 2) snapshot("warm");
	}
	if (g.dev.paused) {
		g.dev.paused = false;
		continue;
	}
	// «залипание» — экран не меняется дольше 15 с (бой с таймером не в счёт: он идёт до 110–200 с);
	// считаем один раз на застревание, а выбираться пробуем каждые 15 с
	if (sameFor > 900 && sameFor % 900 < 3) {
		if (S !== "fight") {
			stuck++;
			stuckBy[S] = (stuckBy[S] || 0) + 1;
		}
		for (const h of (g.dev.hits || []).slice()) {
			g.clickHit(h);
			g.step(2);
			if (g.dev.S !== S) break;
		}
		g.key(" ");
	}
	if (sameFor > 6000) break;
	if (S === "msg" && g.dev.run("!!(EV && EV.open && EV.pick)")) {
		// событие с выбором («выбери одну реликвию»): пробел его не закрывает — тыкаем карту, потом «Забрать»
		const take = g.dev.findHit("Забрать"),
			hs = g.dev.hits || [];
		if (take && g.dev.run("EV.sel >= 0")) g.clickHit(take);
		else if (hs.length) g.clickHit(hs[pickIdx(hs.length)]);
	} else if (S === "prep" || S === "msg") g.key(" ");
	else if (S === "fight") {
		if (f % 30 === 0) g.key(String(1 + pickIdx(3)));
	} else if (S === "map") {
		const av = g.dev.avail() || [];
		if (av.length) {
			const n = g.dev.N[av[pickIdx(av.length)]];
			g.click(n.x, n.y);
		}
	} else if (S === "shop" || S === "world" || S === "codex" || S === "pick") {
		const hs = g.dev.hits || [];
		if (hs.length) g.clickHit(hs[pickIdx(hs.length)]);
	} else if (S === "win" || S === "lose") {
		g.clickHit((g.dev.hits || [])[0]); // «Новый поход» / «Ещё раз»
	} else if (S === "menu") {
		g.clickHit((g.dev.hits || [])[1 + pickIdx(2)]); // «Новая игра» или «Боевая арена»
	} else if (S === "settings") {
		// «Назад» ищем по подписи: правее него теперь стоят «Экспорт»/«Импорт» (окно переноса сохранения)
		const back = g.dev.findHit("Назад"),
			hs = g.dev.hits || [];
		g.clickHit(back || hs[hs.length - 1]);
	}
}

if (SNAPDIR) snapshot("end"); // конец свободной игры — разница с warm показывает, что именно выросло

// Отдельная фаза «30 боёв подряд в одинаковых условиях» — именно она отвечает
// на вопрос об утечке: миры и герои по ходу партии прогревают свои кэши один раз,
// и этот рост к утечке не относится.
// Главный цикл мог оборваться посреди боя: newGame() обнуляет F, но не экран,
// поэтому сначала уходим в меню — как это делает сама игра перед новой партией.
g.dev.paused = false;
g.dev.S = "menu";
g.step(2);
g.dev.seed(424242);
g.dev.newGame();
g.step(10);
const battleHeap = [];
for (let i = 0; i < 32; i++) {
	g.dev.seed(9000 + i * 31);
	for (let k = 0; k < 8; k++) g.dev.setSlot(k, null);
	for (let k = 0; k < 4; k++) g.dev.setSlot(k, g.dev.HEROES[k]);
	g.dev.setWorld(0, 4);
	g.dev.S = "menu"; // прошлый бой оборван на F.out — переход fight → prep таблицей запрещён
	g.dev.fight(i % 4 === 3 ? "boss" : "fight");
	g.dev.startFight();
	let f = 0;
	while (f < 4000) {
		g.step(1);
		f++;
		const F = g.dev.F;
		if (F && F.out) break;
		if (g.dev.S !== "fight") break;
	}
	if (i >= 1 && i % 8 === 7) battleHeap.push(heap());
}
const battleGrowth = battleHeap.length >= 2 ? ((battleHeap[battleHeap.length - 1] - battleHeap[0]) / battleHeap[0]) * 100 : 0;

const heap1 = heap();
const sizes1 = sizes();
const growth = heap0 > 0 ? ((heap1 - heap0) / heap0) * 100 : 0;
// установившийся рост: от второго замера до последнего (первый — ещё прогрев)
const steady = heapSamples.length >= 2 ? ((heapSamples[heapSamples.length - 1] - heapSamples[1]) / heapSamples[1]) * 100 : growth;
const dataSteady = dataSamples.length >= 2 ? ((dataSamples[dataSamples.length - 1] - dataSamples[1]) / dataSamples[1]) * 100 : 0;
const fatal = g.fatal ? String(g.fatal).slice(0, 200) : null;

console.log(`soak: ${MINUTES} минут игрового времени (${g.frames} кадров, сид ${SEED})`);
console.log(`  экраны: ${[...seen.entries()].map(([k, v]) => k + "×" + v).join(", ")}`);
console.log(`  переходов экранов ${states}, «залипаний» ${stuck}${stuck ? " (" + Object.entries(stuckBy).map(([k, v]) => k + "×" + v).join(", ") + ")" : ""}`);
console.log(`  ошибок консоли ${g.errors.length}, NaN/Infinity в состоянии ${nan}, fatal ${fatal ? "ДА: " + fatal : "нет"}`);
const fmtv = (v) => (typeof v === "number" && !Number.isInteger(v) ? v.toFixed(2) : v);
console.log(`  кэши/подписки (до → после): ${Object.keys(sizes0).map((k) => k + " " + fmtv(sizes0[k]) + "→" + fmtv(sizes1[k])).join(", ")}`);
console.log(
	`  куча: ${heap0.toFixed(1)} → ${heap1.toFixed(1)} МБ (всего ${growth >= 0 ? "+" : ""}${growth.toFixed(1)}%, ` +
		`после прогрева ${steady >= 0 ? "+" : ""}${steady.toFixed(1)}%; замеры: ${heapSamples.map((v) => v.toFixed(1)).join(" → ")})`
);
if (dataSamples.length >= 2)
	console.log(
		`  данные без кода V8 (new/old/large space): ${dataSamples[1].toFixed(1)} → ${dataSamples[dataSamples.length - 1].toFixed(1)} МБ после прогрева ` +
			`(${dataSteady >= 0 ? "+" : ""}${dataSteady.toFixed(1)}%)`
	);

console.log(
	`  30 боёв подряд (один мир, одинаковый состав): ${battleHeap.map((v) => v.toFixed(1)).join(" → ")} МБ, рост ${battleGrowth >= 0 ? "+" : ""}${battleGrowth.toFixed(1)}%`
);
const ok = !fatal && nan === 0 && g.errors.length === 0 && battleGrowth <= 5;
if (!ok && g.errors.length) {
	console.log("  первые ошибки:", g.errors.slice(0, 5));
	const e = g.dev.errs()[0];
	if (e) console.log("  первая по журналу: кадр " + e.frame + ", экран " + e.screen + "\n    " + String(e.stack || "").split("\n").slice(0, 4).join("\n    "));
}
process.exit(ok ? 0 : 1);
