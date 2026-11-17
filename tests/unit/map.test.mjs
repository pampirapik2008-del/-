// Фон карты собирается порциями (bakeStep): результат тот же, что у синхронной сборки,
// игра продолжает рисовать кадры, экран карты показывает прогресс.
import test from "node:test";
import assert from "node:assert/strict";
import { boot } from "../harness/boot.mjs";

// контрольные суммы пикселей земли, снятые с прежней (синхронной) версии bakeMap
const REF = { "777:0": "3800ca6b", "4242:3": "7c5074d3", "99:9": "05fb3cfa" };
const sumCode = (seed, wi) => `(() => {
	const w = WORLDS[${wi}], P = MAPT[w.id];
	const J = { seed: ${seed}, id: { data: new Uint8ClampedArray(609 * 270 * 4) }, cols: P.g.map(hex3), R2: rng32(${seed} + 5) };
	for (let y = 0; y < 270; y += 7) bakeGround(J, y, Math.min(270, y + 7)); // нарезка строк как в bakeStep
	const p = J.id.data; let h = 0x811c9dc5;
	for (let i = 0; i < p.length; i++) { h ^= p[i]; h = Math.imul(h, 16777619); }
	return (h >>> 0).toString(16).padStart(8, "0");
})()`;

test("земля карты по строкам совпадает с прежней синхронной сборкой бит-в-бит", async () => {
	const g = boot();
	assert.ok(await g.ready());
	g.step(3);
	for (const k of Object.keys(REF)) {
		const [seed, wi] = k.split(":").map(Number);
		assert.equal(g.dev.run(sumCode(seed, wi)), REF[k], "сид " + k);
	}
});

test("запекание идёт порциями между кадрами, карта показывает прогресс и появляется по готовности", async () => {
	const g = boot({ bakeMs: 0.2 }); // крошечный бюджет — много кадров
	assert.ok(await g.ready());
	g.step(3);
	g.dev.seed(99); // у этого сида на карте есть озеро (сверено с синхронной версией: MAPL = [[200.19, 161.45, 44, 33]])
	g.dev.newGame();
	g.dev.S = "map";
	assert.equal(g.dev.run("!!MAPJ"), true, "после newGame работа заведена");
	assert.equal(g.dev.run("MAPK"), null, "ключ готовности ещё не выставлен");
	assert.equal(g.dev.run("SD"), g.dev.run("MAPJ.seed"), "сид выставлен сразу (нужен боям и сейву)");
	let frames = 0,
		lastPy = 0,
		sawProgress = false;
	while (g.dev.run("!!MAPJ") && frames < 2000) {
		g.step(1);
		frames++;
		const py = g.dev.run("MAPJ ? MAPJ.py : 270");
		assert.ok(py >= lastPy, "строки обрабатываются по порядку");
		lastPy = py;
		const pr = g.dev.run("bakeProgress()");
		if (pr > 0 && pr < 0.93) sawProgress = true;
	}
	assert.ok(frames >= 10, `работа заняла ${frames} кадров — должна быть разложена на много`);
	assert.ok(sawProgress, "полоса прогресса показывала промежуточные значения");
	assert.equal(g.dev.run("MAPJ"), null);
	assert.equal(g.dev.run("MAPK"), g.dev.run("SD + ':' + G.w"), "ключ готовности = сид:мир");
	assert.deepEqual(
		g.dev.run("JSON.stringify(MAPL.map((q) => q.map((v) => +v.toFixed(2))))"),
		"[[200.19,161.45,44,33]]",
		"озеро там же, где его ставила синхронная версия"
	);
	assert.equal(g.dev.S, "map");
	assert.equal(g.fatal, null);
	assert.equal(g.dev.errs().length, 0, "ни одного сбоя кадра за время загрузки");
});

test("повторный вызов с тем же ключом не перезапускает работу, новый сид — перезапускает", async () => {
	const g = boot({ bakeMs: 0.2 });
	assert.ok(await g.ready());
	g.step(3);
	g.dev.seed(5);
	g.dev.newGame();
	g.step(3);
	const py = g.dev.run("MAPJ.py"),
		seed = g.dev.run("SD");
	g.dev.run(`bakeMap(${seed})`);
	assert.equal(g.dev.run("MAPJ.py"), py, "та же работа продолжается");
	g.dev.run(`bakeMap(${seed} + 1)`);
	assert.equal(g.dev.run("MAPJ.py"), 0, "другой сид — работа начата заново");
	assert.equal(g.dev.run("SD"), seed + 1);
	g.dev.bakeNow();
	assert.equal(g.dev.run("MAPJ"), null);
	assert.equal(g.dev.run("MAPK"), seed + 1 + ":0");
	// готовая карта с тем же ключом не пересобирается
	g.dev.run(`bakeMap(${seed} + 1)`);
	assert.equal(g.dev.run("MAPJ"), null);
	assert.equal(g.fatal, null);
});

test("по умолчанию обвязка собирает карту в первом же кадре (снимки и golden детерминированы)", async () => {
	const g = boot();
	assert.ok(await g.ready());
	g.step(3);
	g.dev.seed(777);
	g.dev.newGame();
	g.step(1);
	assert.equal(g.dev.run("MAPJ"), null);
	assert.equal(g.dev.run("MAPK"), g.dev.run("SD + ':0'"));
});
