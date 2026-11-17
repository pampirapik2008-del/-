// Утечки: кэши и подписки не должны расти от кадра к кадру и от боя к бою.
import test from "node:test";
import assert from "node:assert/strict";
import { boot } from "../harness/boot.mjs";

async function fightWith(rar) {
	const g = boot();
	assert.ok(await g.ready(), "игра загрузилась");
	g.step(5);
	g.dev.seed(3);
	g.dev.newGame();
	for (let k = 0; k < 8; k++) g.dev.setSlot(k, null);
	g.dev.setSlot(0, g.dev.HEROES[0]);
	g.dev.setSlot(1, g.dev.HEROES[1]);
	g.dev.run(`G.slots[0].r = ${rar}`);
	g.dev.setWorld(0, 4);
	g.dev.fight("fight");
	g.dev.startFight();
	g.step(30);
	return g;
}
const sizes = (g) =>
	JSON.parse(
		g.dev.run(
			'JSON.stringify({ ...cacheStats(), ev: Object.values(Events.h).reduce((n, a) => n + a.length, 0), timers: Timers.list.length, bts: Object.keys(BTS).length })'
		)
	);

test("радужное свечение мифического героя не плодит холсты каждый кадр", async () => {
	const g = await fightWith(6);
	assert.equal(g.dev.S, "fight");
	const a = sizes(g);
	g.step(600);
	const b = sizes(g);
	// тон квантован до 6°: радужная палитра — не больше 60 холстов за всё время, а не по одному на кадр
	assert.ok(b.glow - a.glow <= 60, `GLOWC вырос на ${b.glow - a.glow} за 600 кадров`);
	assert.ok(b.glow <= 512, "предохранитель держит кэш свечения в пределах 512 холстов");
	g.step(600);
	const c = sizes(g);
	assert.ok(c.glow - b.glow <= 6, `после одного оборота палитры (3 с) кэш свечения не растёт (+${c.glow - b.glow})`);
	assert.equal(g.fatal, null);
	assert.equal(g.dev.errs().length, 0);
});

test("подписки Events, таймеры и кэши силуэтов не растут от боя к бою", async () => {
	const g = await fightWith(2);
	const run = () => {
		g.dev.S = "menu";
		g.step(2);
		g.dev.fight("fight");
		g.dev.startFight();
		g.step(240);
	};
	run();
	const a = sizes(g);
	for (let i = 0; i < 5; i++) run();
	const b = sizes(g);
	assert.equal(b.ev, a.ev, "число подписчиков Events неизменно");
	assert.ok(b.timers <= a.timers + 2, `таймеров: ${a.timers} → ${b.timers}`);
	assert.ok(b.sil - a.sil <= 24, `силуэты кэшируются по кадру атласа, а не по бою: ${a.sil} → ${b.sil}`);
	assert.equal(b.tint, a.tint, "перекраски атласов — по миру, а не по бою");
	assert.equal(b.floors, a.floors, `холсты пола арены берутся из пула: ${a.floors} → ${b.floors}`);
	assert.ok(b.floors <= 3, "в пуле не больше трёх холстов пола (бой, фон наград, новый)");
	assert.ok(b.glow - a.glow <= 40, `свечения: ${a.glow} → ${b.glow}`);
	assert.equal(g.fatal, null);
});

test("кэши холстов ограничены: силуэты — FIFO на 512 кадров, перекраски — LRU на 12 миров", async () => {
	const g = await fightWith(2);
	// 700 разных «кадров» одного атласа и один цвет — очередь держит не больше SIL_MAX записей
	const sil = JSON.parse(
		g.dev.run(`(() => {
			for (let i = 0; i < 700; i++) silFr(IMG.heroes, [(i % 50) * 10, ((i / 50) | 0) * 10, 8, 8, 0, 0], "#ffffff");
			const first = silFr(IMG.heroes, [0, 0, 8, 8, 0, 0], "#ffffff"), again = silFr(IMG.heroes, [0, 0, 8, 8, 0, 0], "#ffffff");
			return JSON.stringify({ n: cacheStats().sil, same: first === again, w: first.width, h: first.height, mb: cacheStats().mb });
		})()`)
	);
	assert.ok(sil.n <= 512, `силуэтов в очереди ${sil.n}`);
	assert.ok(sil.same, "повторный запрос того же кадра и цвета отдаёт тот же холст");
	assert.deepEqual([sil.w, sil.h], [8, 8], "холст силуэта — размером с кадр, а не с атлас");
	// перекраски всех десяти миров (реквизит, две пары монстров, карта) — в кэше остаются ≤ 12 последних
	const tint = JSON.parse(
		g.dev.run(`(() => {
			const made = [];
			for (const w of WORLDS) { propImg(w); mobImg(w, "a"); mobImg(w, "m"); mapImg(w); made.push(TINTC.size); }
			const last = WORLDS[WORLDS.length - 1], keep = mobImg(last, "a") === mobImg(last, "a");
			return JSON.stringify({ max: Math.max(...made), size: TINTC.size, keep, floors: FLOORP.length, mb: cacheStats().mb });
		})()`)
	);
	assert.ok(tint.max <= 12 && tint.size <= 12, `перекрасок в кэше ${tint.size} (пик ${tint.max})`);
	assert.ok(tint.keep, "свежая запись остаётся в кэше после вытеснения старых");
	assert.ok(tint.mb < 8, `растры всех кэшей после обхода миров: ${tint.mb.toFixed(2)} МБ`);
	assert.equal(g.fatal, null);
	assert.equal(g.dev.errs().length, 0);
});
