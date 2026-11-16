// Сохранения: конверт v3, контрольная сумма, резервный слот, миграция v2.
import test from "node:test";
import assert from "node:assert/strict";
import { boot } from "../harness/boot.mjs";

const SAVEK = "monsterAwakeningSave";
const SAVEK_B = SAVEK + ".bak";

async function fresh() {
	const g = boot();
	assert.ok(await g.ready(), "игра загрузилась");
	g.step(5);
	g.dev.newGame();
	g.dev.setSlot(0, g.dev.HEROES[0]);
	return g;
}

test("saveGame пишет конверт v3 с контрольной суммой", async () => {
	const g = await fresh();
	g.dev.G.coin = 55;
	assert.equal(g.dev.saveGame(), true);
	const env = JSON.parse(g.readStorage(SAVEK));
	assert.equal(env.v, 3);
	assert.equal(typeof env.sum, "string");
	assert.equal(typeof env.data, "string");
	const inner = JSON.parse(env.data);
	assert.equal(inner.g.coin, 55);
	assert.ok(Array.isArray(inner.N) && inner.N.length > 0);
});

test("повреждённая сумма: основное не читается, подхватывается резерв", async () => {
	const g = await fresh();
	g.dev.G.coin = 10;
	g.dev.saveGame();
	g.dev.G.coin = 20;
	g.dev.saveGame(); // прошлое (10) уехало в резерв
	const main = JSON.parse(g.readStorage(SAVEK));
	main.data = main.data.replace(/"coin":20/, '"coin":9999'); // данные изменены, сумма осталась старой
	g.setStorage(SAVEK, JSON.stringify(main));
	assert.equal(g.dev.loadGame(), true, "загрузка прошла из резерва");
	assert.equal(g.dev.G.coin, 10, "взято именно резервное значение");
});

test("старое сохранение v2 грузится и переписывается в v3", async () => {
	const g = await fresh();
	assert.equal(g.dev.saveGame(), true);
	const env = JSON.parse(g.readStorage(SAVEK) || "null");
	// соберём v2 из актуального содержимого
	const inner = env && env.data ? JSON.parse(env.data) : null;
	assert.ok(inner, "есть что конвертировать");
	const v2 = JSON.stringify({ v: 2, N: inner.N, E: inner.E, sd: inner.sd, bi: 0, g: inner.g });
	g.setStorage(SAVEK, v2);
	g.delStorage(SAVEK_B);
	assert.equal(g.dev.loadGame(), true, "v2 загрузился");
	assert.equal(g.dev.S, "map");
	const after = JSON.parse(g.readStorage(SAVEK));
	assert.equal(after.v, 3, "после загрузки сейв переписан в v3");
});

test("чужой мусор в слоте не ломает состояние", async () => {
	const g = await fresh();
	const before = { coin: g.dev.G.coin, S: g.dev.S };
	for (const bad of ["", "null", "[]", "{}", '{"v":3}', '{"v":99}', "мусор"]) {
		g.setStorage(SAVEK, bad);
		g.delStorage(SAVEK_B);
		assert.equal(g.dev.loadGame(), false, `должно вернуть false: ${bad}`);
		g.step(2);
		assert.equal(g.dev.S, before.S, "экран не поменялся");
	}
	assert.equal(g.fatal, null);
});

test("delSave очищает оба слота", async () => {
	const g = await fresh();
	g.dev.G.coin = 1;
	g.dev.saveGame();
	g.dev.G.coin = 2;
	g.dev.saveGame(); // второй вызов кладёт предыдущее в резерв
	assert.ok(g.readStorage(SAVEK), "основной слот есть");
	assert.ok(g.readStorage(SAVEK_B), "резерв есть");
	g.dev.delSave();
	assert.equal(g.readStorage(SAVEK), null, "основной слот удалён");
	assert.equal(g.readStorage(SAVEK_B), null, "резерв удалён");
	assert.equal(g.dev.loadGame(), false, "загружать больше нечего");
});
