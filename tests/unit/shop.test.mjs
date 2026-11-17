// Лавка и реликвии: цены, реролл, покупка, стоимость, applyPerks/grantRelic/relBonus.
import test from "node:test";
import assert from "node:assert/strict";
import { boot } from "../harness/boot.mjs";

async function game() {
	const g = boot();
	assert.ok(await g.ready(), "игра загрузилась");
	g.step(5);
	g.dev.seed(777);
	g.dev.newGame();
	g.dev.setSlot(0, g.dev.HEROES[0]);
	g.dev.setSlot(1, g.dev.HEROES[1]);
	g.step(2);
	return g;
}
const J = (g, code) => JSON.parse(g.dev.run("JSON.stringify(" + code + ")"));

test("цены реликвий: таблица по редкости плюс надбавка мира", async () => {
	const g = await game();
	const price = J(g, "BAL.shop.relPrice");
	assert.equal(price.length, 7);
	for (let r = 0; r < 7; r++) {
		assert.equal(g.dev.run(`relPrice(${r}, 0)`), price[r]);
		assert.equal(g.dev.run(`relPrice(${r}, 3)`), price[r] + 3 * J(g, "BAL.shop.relPriceW"));
	}
	assert.equal(g.dev.run("relPrice(2)"), price[2], "без мира — базовая цена");
	// цены растут с редкостью
	for (let r = 1; r < 7; r++) assert.ok(price[r] > price[r - 1]);
});

test("ассортимент: 3 разные реликвии, реролл дорожает и сохраняет купленное", async () => {
	const g = await game();
	g.dev.run("G.shop = true; G.w = 0; G.coin = 1000; shopStock()");
	const st = J(g, "G.stock");
	assert.equal(st.rel.length, J(g, "BAL.shop.stock"));
	assert.equal(new Set(st.rel.map((q) => q.id)).size, st.rel.length, "без повторов");
	assert.equal(st.rr, 0);
	assert.equal(g.dev.run("rrPrice()"), J(g, "BAL.shop.rrBase"));
	// покупка первой позиции: монеты списаны по цене, реликвия у отряда, позиция помечена
	const q0 = st.rel[0],
		p0 = g.dev.run(`relPrice(${q0.r}, G.w)`);
	assert.equal(g.dev.run("buyRelic(0)"), true);
	assert.equal(g.dev.run("G.coin"), 1000 - p0);
	assert.equal(J(g, "G.stock.rel[0].sold"), 1);
	assert.deepEqual(J(g, "G.rel"), [{ id: q0.id, r: q0.r }]);
	assert.equal(g.dev.run("buyRelic(0)"), false, "повторно не продаётся");
	assert.equal(g.dev.run("G.coin"), 1000 - p0, "монеты не списаны повторно");
	// реролл: цена rrBase + rrStep*rr, купленное остаётся, остальное новое
	const coin1 = g.dev.run("G.coin");
	g.dev.run("reroll()");
	assert.equal(g.dev.run("G.coin"), coin1 - J(g, "BAL.shop.rrBase"));
	assert.equal(J(g, "G.stock.rr"), 1);
	assert.equal(g.dev.run("rrPrice()"), J(g, "BAL.shop.rrBase") + J(g, "BAL.shop.rrStep"));
	const st2 = J(g, "G.stock");
	assert.equal(st2.rel.length, 3);
	assert.deepEqual(st2.rel.filter((q) => q.sold).map((q) => q.id), [q0.id], "купленная позиция сохранена");
	assert.equal(new Set(st2.rel.map((q) => q.id)).size, 3);
	// не хватает монет — отказ без списания, сообщение лавки
	g.dev.run("G.coin = 0");
	g.dev.run("reroll()");
	assert.equal(g.dev.run("G.coin"), 0);
	assert.equal(J(g, "G.stock.rr"), 1);
	assert.equal(g.dev.run("G.sm"), "Не хватает монет");
	const idx = st2.rel.findIndex((q) => !q.sold);
	assert.equal(g.dev.run(`buyRelic(${idx})`), false);
	assert.equal(g.dev.run("G.coin"), 0);
	assert.equal(g.fatal, null);
});

test("лавка открывается только после победы, а экран лавки — через машину", async () => {
	const g = await game();
	g.dev.S = "map";
	g.step(1);
	g.dev.run("G.shop = false; openShop()");
	assert.equal(g.dev.S, "map", "закрыта — остаёмся на карте");
	g.dev.run("G.shop = true; openShop()");
	assert.equal(g.dev.S, "shop");
	assert.ok(J(g, "G.stock").rel.length === 3);
});

test("реликвии: grantRelic меняет характеристики по множителю редкости, applyPerks — новобранца", async () => {
	const g = await game();
	const base = J(g, "G.slots.filter(Boolean).map((u) => ({ atk: u.atk, arm: u.arm, max: u.max, hp: u.hp, spd: u.spd, aspd: u.aspd }))");
	const RAR = J(g, "RAR.map((r) => r.m)");
	assert.deepEqual(RAR, [1, 1.5, 2.2, 3.2, 4.5, 6.5, 9]);
	// клык вожака (атака +8 % × m), редкость 2 (m = 2.2)
	g.dev.run('grantRelic({ id: "fang", r: 2 })');
	const after = J(g, "G.slots.filter(Boolean).map((u) => ({ atk: u.atk, arm: u.arm, max: u.max, hp: u.hp }))");
	after.forEach((u, i) => assert.equal(u.atk, Math.round(base[i].atk * (1 + 0.08 * 2.2))));
	// каменный панцирь: броня +6 × m, редкость 0
	g.dev.run('grantRelic({ id: "shell", r: 0 })');
	J(g, "G.slots.filter(Boolean).map((u) => u.arm)").forEach((arm, i) => assert.equal(arm, base[i].arm + 6));
	// амулет жизни: максимум ×(1+0.1m), текущее здоровье растёт на ту же величину
	g.dev.run('grantRelic({ id: "heart", r: 4 })');
	J(g, "G.slots.filter(Boolean).map((u) => ({ max: u.max, hp: u.hp }))").forEach((u, i) => {
		const mx = Math.round(base[i].max * (1 + 0.1 * 4.5));
		assert.equal(u.max, mx);
		assert.equal(u.hp, base[i].hp + (mx - base[i].max));
	});
	assert.deepEqual(
		J(g, "G.rel"),
		[
			{ id: "fang", r: 2 },
			{ id: "shell", r: 0 },
			{ id: "heart", r: 4 },
		]
	);
	// новобранец получает те же бонусы через applyPerks (recruit вызывает его сам)
	const fresh = J(g, "(() => { const h = HEROES[2]; const u0 = mkU(h, 0, 0, 0); const u = recruit(h, 0); return { atk0: u0.atk, arm0: u0.arm, max0: u0.max, atk: u.atk, arm: u.arm, max: u.max }; })()");
	assert.equal(fresh.atk, Math.round(fresh.atk0 * (1 + 0.08 * 2.2)));
	assert.equal(fresh.arm, fresh.arm0 + 6);
	assert.equal(fresh.max, Math.round(fresh.max0 * (1 + 0.1 * 4.5)));
	// боевые реликвии суммируются в relBonus с потолками
	g.dev.run('G.rel.push({ id: "frost", r: 6 }, { id: "frost", r: 6 }, { id: "tome", r: 6 }, { id: "feather", r: 6 }, { id: "blood", r: 1 })');
	const b = J(g, "relBonus()");
	assert.equal(b.frz, 0.5, "заморозка не выше 50 %");
	assert.equal(b.cdr, 0.54, "фолиант m=9: 0.06×9 = 0.54 ≤ 0.6");
	assert.equal(b.phx, 1);
	assert.equal(+b.ls.toFixed(3), 0.06);
	assert.equal(g.fatal, null);
});
