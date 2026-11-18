// Этап E: баланс вынесен в таблицу BAL без изменения чисел.
// Здесь зафиксированы значения, которые раньше были литералами в коде (40_fight.js, 60_game.js, 20_data.js).
// Расхождение означает, что кто-то поменял баланс — тогда нужна запись в docs/BALANCE.md и перезапись golden.
import test from "node:test";
import assert from "node:assert/strict";
import { boot } from "../harness/boot.mjs";

const OLD = {
	fight: { timer: 110, bossTimer: 200, timeoutEdge: 0.05, subStep: 0.025, maxSub: 16, outWin: 1.5, outWinBoss: 3.1, outLose: 1.3 },
	dmg: {
		armK: 100,
		critHero: 0.06,
		critFoe: 0.05,
		critMul: 1.8,
		shockMul: 1.15,
		enMax: 100,
		enHit: 8,
		enTaken: 4,
		enTick: 2.2,
		dotTick: 0.5,
		hazTick: 0.5,
		hazDmg: 0.015,
		hazDmgBoss: 0.004,
		hazSt: 0.006,
		poolDmg: 0.3,
		curseHeal: 0.5,
		soulHeal: 0.05,
		skullCoin: 8,
	},
	rar: { w: [52, 27, 14, 5.2, 1.5, 0.3, 0.08], luckK: 0.28 },
	shop: { relPrice: [8, 12, 18, 28, 45, 80, 140], relPriceW: 2, rrBase: 3, rrStep: 2, stock: 3 },
	foe: { hpK: 1.14, atkK: 1.12, armK: 0.2, bossHp: 0.25, bossHpK: 1.3 },
	win: {
		healFloor: 0.25,
		healBonus: 0.2,
		arenaCoin: 8,
		arenaCoinWave: 2,
		bossCoin: 20,
		bossMeat: 3,
		fightCoin: 6,
		arenaNodeCoin: 10,
		relicChance: 0.14,
		swampRelicChance: 0.4,
	},
};

let g;
test.before(async () => {
	g = boot();
	assert.ok(await g.ready(8000), "игра не загрузилась");
});

test("таблица BAL совпадает со старыми литералами (автосверка)", () => {
	const bal = JSON.parse(g.dev.run("JSON.stringify(BAL)"));
	assert.deepEqual(bal, OLD);
});

test("производные формулы дают прежние числа", () => {
	const r = (c) => JSON.parse(g.dev.run("JSON.stringify(" + c + ")"));
	// цена реликвии: таблица + 2 за мир
	assert.equal(r("relPrice(2, 3)"), 18 + 6);
	assert.equal(r("relPrice(6, 0)"), 140);
	// бросок редкости с фиксированным rnd01: 0.5 от суммы весов → «Обычная», 0.999 → высокая редкость
	assert.equal(r("rollRar(0, 0, () => 0.5)"), 0);
	assert.equal(r("rollRar(0, 0, () => 0.99999)"), 6);
	assert.equal(r("rollRar(0, 2, () => 0.01)"), 2, "нижняя граница редкости");
	// враги: мир 0 — базовые числа, мир 3 — рост по 1.14/1.12/броня ×1.6
	// foeDef содержит ссылки на канвасы спрайтов — берём только числа
	const fd = (w, slot) => r(`(({ hp, atk, arm }) => ({ hp, atk, arm }))(foeDef(${w}, "${slot}"))`);
	const e0 = fd(0, "a"),
		e3 = fd(3, "a"),
		b3 = fd(3, "boss"),
		b0 = fd(0, "boss");
	assert.equal(e3.hp, Math.round(e0.hp * Math.pow(1.14, 3)));
	assert.equal(e3.atk, Math.round(e0.atk * Math.pow(1.12, 3)));
	assert.equal(e3.arm, Math.round(r("ENEM.slime.arm") * 1.6));
	assert.equal(b0.hp, Math.round(r("ENEM.boss.hp") * 0.25));
	assert.equal(b3.hp, Math.round(r("ENEM.boss.hp") * 0.25 * Math.pow(1.3, 3)));
	// таймер боя
	g.dev.newGame();
	g.dev.fight("norm");
	assert.equal(g.dev.F.timer, 110);
	g.dev.fight("boss");
	assert.equal(g.dev.F.timer, 200);
});
