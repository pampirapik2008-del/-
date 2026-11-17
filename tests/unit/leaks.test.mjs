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
			'JSON.stringify({ glow: Object.keys(GLOWC).length, sil: SILC.size, tint: Object.keys(TINTC).length, ev: Object.values(Events.h).reduce((n, a) => n + a.length, 0), timers: Timers.list.length, bts: Object.keys(BTS).length })'
		)
	);

test("радужное свечение мифического героя не плодит холсты каждый кадр", async () => {
	const g = await fightWith(6);
	assert.equal(g.dev.S, "fight");
	const a = sizes(g);
	g.step(600);
	const b = sizes(g);
	// тон округлён до градуса: не больше 360 новых ключей за всё время, а не по одному на кадр
	assert.ok(b.glow - a.glow <= 360, `GLOWC вырос на ${b.glow - a.glow} за 600 кадров`);
	assert.ok(b.glow <= 512, "предохранитель держит кэш свечения в пределах 512 холстов");
	g.step(600);
	const c = sizes(g);
	assert.ok(c.glow - b.glow <= 40, `после прогрева палитры кэш почти не растёт (+${c.glow - b.glow})`);
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
	assert.equal(b.sil, a.sil, "силуэты кэшируются по атласу, а не по бою");
	assert.equal(b.tint, a.tint, "перекраски атласов — по миру, а не по бою");
	assert.ok(b.glow - a.glow <= 40, `свечения: ${a.glow} → ${b.glow}`);
	assert.equal(g.fatal, null);
});
