// Ошибка в кадре не должна убивать игру: цикл продолжается, сбой попадает в журнал,
// а три сбоя подряд открывают аварийное окно вместо мёртвого экрана.
import test from "node:test";
import assert from "node:assert/strict";
import { boot } from "../harness/boot.mjs";

test("сбой в draw не останавливает цикл и попадает в журнал", async () => {
	const g = boot();
	assert.ok(await g.ready(), "игра загрузилась");
	g.step(10);
	const before = g.frames;
	g.dev.makeDrawThrow(1);
	g.step(6);
	assert.equal(g.frames, before + 6, "кадры продолжают идти");
	assert.equal(g.fatal, null, "исключение не всплыло наружу");
	const errs = g.dev.errs();
	assert.ok(errs.length >= 1, "ошибка записана в журнал");
	assert.equal(errs[0].kind, "draw");
	assert.match(errs[0].msg, /тестовая ошибка draw/);
	assert.equal(g.dev.crash(), false, "одного сбоя мало для аварийного режима");
});

test("сбой в update не мешает отрисовке", async () => {
	const g = boot();
	assert.ok(await g.ready());
	g.step(5);
	g.dev.makeUpdateThrow(1);
	g.step(6);
	assert.equal(g.fatal, null);
	const errs = g.dev.errs();
	assert.ok(errs.some((e) => e.kind === "update"), "update-ошибка в журнале");
	assert.equal(g.dev.crash(), false);
});

test("три сбоя подряд открывают аварийное окно", async () => {
	const g = boot();
	assert.ok(await g.ready());
	g.step(5);
	g.dev.makeDrawThrow(10);
	g.step(4);
	assert.equal(g.fatal, null, "игра не падает");
	assert.equal(g.dev.crash(), true, "аварийный режим включился");
	assert.ok(g.dev.errs().length >= 3);
});

test("после успешного кадра серия сбоев сбрасывается", async () => {
	const g = boot();
	assert.ok(await g.ready());
	g.step(5);
	g.dev.makeDrawThrow(1);
	g.step(2); // один сбой, потом кадры нормальные
	g.step(3);
	g.dev.makeDrawThrow(1);
	g.step(2);
	g.step(3);
	assert.equal(g.dev.crash(), false, "сбои были не подряд — окна быть не должно");
});
