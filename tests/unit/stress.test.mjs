// Устойчивость (этап S): быстрые нажатия, потеря фокуса, пропавшее время.
import test from "node:test";
import assert from "node:assert/strict";
import { createDom } from "../harness/dom.mjs";
import { boot } from "../harness/boot.mjs";

// собственный генератор теста: нажатия не должны зависеть от Rand игры и не трогать его
const mkRnd = (seed) => {
	let s = seed >>> 0;
	return () => {
		s = (s + 0x6d2b79f5) >>> 0;
		let q = Math.imul(s ^ (s >>> 15), 1 | s);
		q = (q + Math.imul(q ^ (q >>> 7), 61 | q)) ^ q;
		return ((q ^ (q >>> 14)) >>> 0) / 4294967296;
	};
};
const SCREENS = new Set(["menu", "pick", "map", "msg", "shop", "world", "prep", "fight", "win", "lose", "codex", "settings", "stats", "save"]);
// поиск NaN/Infinity в состоянии (как в soak)
const BAD = `(() => { const seen = new Set(); let bad = ""; const walk = (o, p, d) => { if (bad || d > 6 || !o || typeof o !== "object" || seen.has(o)) return; seen.add(o); for (const k in o) { const v = o[k]; if (typeof v === "number" && !isFinite(v)) { bad = p + "." + k + "=" + v; return; } if (v && typeof v === "object" && !(v instanceof Map) && !(v instanceof Set) && !ArrayBuffer.isView(v)) walk(v, p + "." + k, d + 1); } }; walk(G, "G", 0); if (typeof F !== "undefined" && F) walk(F, "F", 0); return bad; })()`;

async function started(seed = 5) {
	const g = boot();
	assert.ok(await g.ready());
	g.step(5);
	g.dev.seed(seed);
	g.dev.newGame();
	for (let i = 0; i < 4; i++) g.dev.setSlot(i, g.dev.HEROES[i]);
	g.dev.S = "map";
	g.step(2);
	return g;
}

test("100 нажатий в секунду по случайным точкам 20 секунд: ни исключений, ни NaN, ни неизвестных экранов, ни «залипших» указателей", async () => {
	const g = await started(5);
	const rnd = mkRnd(42);
	const seen = new Map();
	let taps = 0;
	for (let frame = 0; frame < 1200; frame++) {
		// 100/с при 60 кадрах — чередуем 1 и 2 нажатия за кадр; каждое — отдельный указатель, который тут же отпускается
		const n = frame % 3 ? 2 : 1;
		for (let k = 0; k < n; k++) {
			const x = rnd() * 1218,
				y = rnd() * 540;
			g.click(x, y);
			taps++;
			g.dev.run("Input.release({ pointerId: 1 })");
		}
		// время от времени — клавиши (пауза, старт, скорость)
		if (frame % 97 === 0) g.key(["Escape", " ", "Enter", "1", "2", "3", "p"][(rnd() * 7) | 0]);
		g.step(1);
		const s = g.dev.S;
		seen.set(s, (seen.get(s) || 0) + 1);
		assert.ok(SCREENS.has(s), "неизвестный экран " + s);
		if (frame % 60 === 0) assert.equal(g.dev.run(BAD), "", "NaN/Infinity в состоянии на кадре " + frame);
		assert.equal(g.fatal, null, "сбой кадра " + frame);
	}
	assert.equal(taps, 2000, "≈100 нажатий в секунду");
	assert.equal(g.dev.errs().filter((e) => /^(update|draw)/.test(e.kind)).length, 0, "ошибок кадра нет: " + JSON.stringify(g.dev.errs().slice(0, 3)));
	assert.equal(g.dev.run("Input.active.size"), 0, "удержанных указателей не осталось");
	assert.ok(seen.size >= 3, "нажатия что-то делали — экранов побывало: " + [...seen.keys()].join(","));
	assert.ok(g.dev.run("Input.taps") >= 50, "часть нажатий попала по целям: " + g.dev.run("Input.taps"));
	assert.ok(g.dev.run("hits.length") < 200, "цели кадра не копятся: " + g.dev.run("hits.length"));
});

test("многопальцевый шквал в бою: вторичные указатели отбрасываются, второй палец не делает второго хода, после отпускания всё чисто", async () => {
	const g = await started(9);
	g.dev.fight("norm");
	g.dev.autoPlace();
	g.dev.startFight();
	g.step(3);
	const rnd = mkRnd(7);
	const ign0 = g.dev.run("Input.ignored");
	for (let frame = 0; frame < 300; frame++) {
		// до пяти пальцев одновременно: первичный + вторичные
		g.dev.run(`(() => { innerWidth = 1218; innerHeight = 540;
			Input.down({ isPrimary: true, pointerId: 1, clientX: ${rnd() * 1218}, clientY: ${rnd() * 540} });
			for (let i = 2; i <= ${2 + ((rnd() * 4) | 0)}; i++) Input.down({ isPrimary: false, pointerId: i, clientX: ${rnd() * 1218}, clientY: ${rnd() * 540} });
			if (${rnd()} < 0.7) for (let i = 1; i <= 6; i++) Input.release({ pointerId: i });
		})()`);
		g.step(1);
		assert.equal(g.fatal, null);
	}
	g.dev.run("for (let i = 1; i <= 6; i++) Input.release({ pointerId: i })");
	assert.ok(g.dev.run("Input.ignored") - ign0 >= 300, "вторичные указатели посчитаны отброшенными");
	assert.equal(g.dev.run("Input.active.size"), 0);
	assert.equal(g.dev.errs().filter((e) => /^(update|draw)/.test(e.kind)).length, 0);
	assert.equal(g.dev.run(BAD), "");
});

test("потеря фокуса: свёрнутая вкладка 30 с — бой на паузе, автосохранение, указатели сброшены, после возврата нет рывка симуляции", async () => {
	const dom = createDom();
	const g = boot({ dom });
	assert.ok(await g.ready());
	g.step(5);
	g.dev.seed(3);
	g.dev.newGame();
	for (let i = 0; i < 4; i++) g.dev.setSlot(i, g.dev.HEROES[i]);
	g.dev.fight("norm");
	g.dev.autoPlace();
	g.dev.startFight();
	g.step(30);
	g.dev.run("Input.down({ isPrimary: true, pointerId: 1, clientX: 600, clientY: 300 })"); // палец на экране в момент сворачивания
	g.delStorage("monsterAwakeningSave");
	const fire = (hidden) => {
		dom.document.hidden = hidden;
		for (const f of dom.docListeners["visibilitychange"] || []) f({});
	};
	const time0 = g.dev.F.time,
		t0 = g.dev.run("t");
	fire(true);
	assert.equal(g.dev.paused, true, "бой встал на паузу");
	assert.equal(g.readStorage("monsterAwakeningSave"), null, "посреди боя автосохранения нет (флаг autosave экрана)");
	assert.equal(g.dev.run("Input.active.size"), 0, "удержанный палец сброшен (отпускания не будет)");
	// 30 секунд без кадров, затем первый кадр по возвращении
	g.jump(30000);
	fire(false);
	g.step(1);
	assert.equal(g.dev.paused, true, "пауза держится до действия игрока");
	assert.equal(g.dev.F.time, time0, "на паузе бой не шёл");
	assert.ok(g.dev.run("t") - t0 < 0.1, "общее время кадра обрезано (не +30 с): " + (g.dev.run("t") - t0));
	// игрок снимает паузу: за первый кадр — не больше Loop.MAX шагов, никакого «догоняния» 30 секунд
	g.dev.run("paused = false");
	g.step(1);
	const steps1 = g.dev.run("Loop.steps");
	assert.ok(steps1 <= g.dev.run("Loop.MAX"), "шагов за кадр: " + steps1);
	assert.ok(g.dev.F === null || g.dev.F.time - time0 <= (g.dev.run("Loop.MAX") + 1) / 60 + 1e-6, "бой продвинулся не больше чем на несколько шагов: " + (g.dev.F && g.dev.F.time - time0));
	g.step(60);
	assert.equal(g.fatal, null);
	assert.equal(g.dev.errs().filter((e) => /^(update|draw)/.test(e.kind)).length, 0);
	assert.equal(g.dev.run(BAD), "");
	// на карте сворачивание пишет автосохранение
	g.dev.run("F = null");
	g.dev.S = "map";
	g.step(2);
	fire(true);
	assert.ok(g.readStorage("monsterAwakeningSave"), "на карте при сворачивании — автосохранение");
	fire(false);
});

test("пропавшее время на карте и в лавке (экран заблокирован 2 минуты): после возврата один кадр — не больше Loop.MAX шагов, экран тот же", async () => {
	const g = await started(11);
	for (const [screen, prep] of [
		["map", ""],
		["shop", "G.shop = 1; openShop()"],
	]) {
		if (prep) g.dev.run(prep);
		else g.dev.S = screen;
		g.step(5);
		assert.equal(g.dev.S, screen);
		const t0 = g.dev.run("t");
		g.jump(120000);
		g.step(1);
		assert.ok(g.dev.run("Loop.steps") <= g.dev.run("Loop.MAX"));
		assert.ok(g.dev.run("t") - t0 <= 0.05 + 1e-9, "t обрезано до 50 мс за кадр");
		assert.equal(g.dev.S, screen, "экран не изменился сам по себе");
		g.step(10);
		assert.equal(g.fatal, null);
	}
	assert.equal(g.dev.errs().filter((e) => /^(update|draw)/.test(e.kind)).length, 0);
});
