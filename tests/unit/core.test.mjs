// Ядро: санитайз чисел, шина событий, менеджер таймеров, фиксированный шаг цикла.
import test from "node:test";
import assert from "node:assert/strict";
import { boot } from "../harness/boot.mjs";

let g;
test.before(async () => {
	g = boot();
	assert.ok(await g.ready(8000), "игра не загрузилась");
});

test("num(): NaN/Infinity/строки → fallback, зажим в диапазон", () => {
	const r = g.dev.run;
	assert.equal(r("num(NaN, 5)"), 5);
	assert.equal(r("num(Infinity, 5)"), 5);
	assert.equal(r("num(-Infinity, 5)"), 5);
	assert.equal(r("num(undefined, 7)"), 7);
	assert.equal(r("num(null, 7)"), 7);
	assert.equal(r('num("", 7)'), 7);
	assert.equal(r('num("12.5", 0)'), 12.5);
	assert.equal(r('num("abc", 3)'), 3);
	assert.equal(r("num(150, 0, 0, 100)"), 100);
	assert.equal(r("num(-4, 0, 0, 100)"), 0);
	assert.equal(r("num(42)"), 42);
	assert.equal(r("num(true, 9)"), 1);
});

test("Events: порядок подписки, off, сбой обработчика не трогает остальных", () => {
	const r = g.dev.run;
	const got = JSON.parse(r(`JSON.stringify((() => {
		const log = [];
		const a = Events.on("t:x", (v) => log.push("a" + v));
		Events.on("t:x", () => { throw new Error("boom"); });
		Events.on("t:x", (v) => log.push("c" + v));
		const n1 = Events.emit("t:x", 1);
		Events.off("t:x", a);
		const n2 = Events.emit("t:x", 2);
		const n0 = Events.emit("t:nobody");
		return { log, n1, n2, n0, lastErr: ERRS.length ? ERRS[ERRS.length - 1].kind : "" };
	})())`));
	assert.deepEqual(got.log, ["a1", "c1", "c2"]);
	assert.equal(got.n1, 3);
	assert.equal(got.n2, 2);
	assert.equal(got.n0, 0);
	assert.equal(got.lastErr, "event:t:x");
});

test("Timers: регистрация по владельцу и снятие одним вызовом", () => {
	const r = g.dev.run;
	const got = JSON.parse(r(`JSON.stringify((() => {
		const base = Timers.count();
		const tgt = { n: 0, addEventListener() { this.n++; }, removeEventListener() { this.n--; } };
		Timers.after(100000, () => {}, "scr");
		Timers.every(100000, () => {}, "scr");
		Timers.on(tgt, "x", () => {}, undefined, "scr");
		const id = Timers.after(100000, () => {}, "other");
		const mid = Timers.count("scr");
		Timers.clearOwner("scr");
		const after = Timers.count("scr");
		Timers.clear(id);
		return { base, mid, after, total: Timers.count(), listeners: tgt.n };
	})())`));
	assert.equal(got.mid, 3);
	assert.equal(got.after, 0);
	assert.equal(got.total, got.base);
	assert.equal(got.listeners, 0);
});

test("Loop.feed: 60 Гц → ровно 1 шаг, 30 Гц → 2, 120 Гц → 0/1 с alpha, длинный кадр → не более MAX", () => {
	const r = g.dev.run;
	const got = JSON.parse(r(`JSON.stringify((() => {
		Loop.reset();
		const out = {};
		out.f60 = [Loop.feed(1 / 60), Loop.feed(16.9 / 1000), Loop.feed(16.2 / 1000)];
		out.acc60 = Loop.acc;
		Loop.reset();
		out.f30 = Loop.feed(1 / 30);
		Loop.reset();
		out.f120 = [Loop.feed(1 / 120), Loop.alpha, Loop.feed(1 / 120), Loop.alpha];
		Loop.reset();
		out.long = Loop.feed(1.0);
		out.after = Loop.feed(1 / 60);
		Loop.reset();
		out.neg = Loop.feed(-1);
		out.max = Loop.MAX;
		Loop.reset();
		return out;
	})())`));
	assert.deepEqual(got.f60, [1, 1, 1], "кадры около 1/60 привязываются к одному шагу");
	assert.equal(got.acc60, 0, "накопитель не дрейфует на 60 Гц");
	assert.equal(got.f30, 2);
	assert.equal(got.f120[0], 0);
	assert.ok(Math.abs(got.f120[1] - 0.5) < 1e-9, "alpha после половины шага = 0.5");
	assert.equal(got.f120[2], 1);
	assert.equal(got.f120[3], 0);
	assert.equal(got.long, got.max, "секунда простоя даёт не больше MAX шагов");
	assert.equal(got.neg, 0);
});
