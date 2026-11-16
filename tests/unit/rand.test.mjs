// Тесты детерминированного генератора: от него зависит воспроизводимость боёв.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = fs.readFileSync(path.join(ROOT, "src/game/00_rand.js"), "utf8");

/** Поднимает Rand в отдельном контексте: так тест видит ровно тот код, что уходит в сборку. */
function makeRand() {
	const ctx = vm.createContext({ Math });
	vm.runInContext(SRC, ctx);
	return {
		seed: (v) => vm.runInContext(`Rand.seed(${v})`, ctx),
		next: () => vm.runInContext("Rand.next()", ctx),
		int: (n) => vm.runInContext(`Rand.int(${n})`, ctx),
		range: (a, b) => vm.runInContext(`Rand.range(${a},${b})`, ctx),
		state: () => vm.runInContext("Rand.state", ctx),
		setState: (v) => vm.runInContext(`Rand.state = ${v}`, ctx),
	};
}

test("одинаковый сид даёт одинаковую последовательность", () => {
	const a = makeRand();
	const b = makeRand();
	a.seed(12345);
	b.seed(12345);
	for (let i = 0; i < 500; i++) assert.equal(a.next(), b.next(), `шаг ${i}`);
});

test("разные сиды дают разные последовательности", () => {
	const a = makeRand();
	const b = makeRand();
	a.seed(1);
	b.seed(2);
	const xa = Array.from({ length: 20 }, () => a.next());
	const xb = Array.from({ length: 20 }, () => b.next());
	assert.notDeepEqual(xa, xb);
});

test("next() всегда в [0,1)", () => {
	const r = makeRand();
	r.seed(777);
	for (let i = 0; i < 5000; i++) {
		const v = r.next();
		assert.ok(v >= 0 && v < 1, `вне диапазона: ${v}`);
	}
});

test("сид 0 не залипает (заменяется на 1)", () => {
	const r = makeRand();
	r.seed(0);
	const a = r.next();
	const b = r.next();
	assert.notEqual(a, b);
	assert.ok(Number.isFinite(a));
});

test("state можно сохранить и восстановить — поток продолжается", () => {
	const r = makeRand();
	r.seed(99);
	r.next();
	const st = r.state();
	const tail = [r.next(), r.next(), r.next()];
	r.setState(st);
	assert.deepEqual([r.next(), r.next(), r.next()], tail);
});

test("int/range не выходят за границы", () => {
	const r = makeRand();
	r.seed(4242);
	for (let i = 0; i < 2000; i++) {
		const v = r.int(7);
		assert.ok(Number.isInteger(v) && v >= 0 && v < 7, `int(7) = ${v}`);
	}
	for (let i = 0; i < 2000; i++) {
		const v = r.range(-3, 5);
		assert.ok(v >= -3 && v < 5, `range = ${v}`);
	}
});

test("среднее у next() близко к 0.5 (нет перекоса)", () => {
	const r = makeRand();
	r.seed(2026);
	let s = 0;
	const n = 200000;
	for (let i = 0; i < n; i++) s += r.next();
	const m = s / n;
	assert.ok(Math.abs(m - 0.5) < 0.01, `среднее ${m}`);
});
