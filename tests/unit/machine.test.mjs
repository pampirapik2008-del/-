// Машина экранов и ввод: таблица переходов, алиас S, хуки enter/exit, слои касаний, lp(e).
import test from "node:test";
import assert from "node:assert/strict";
import { boot } from "../harness/boot.mjs";

async function game() {
	const g = boot();
	assert.ok(await g.ready(), "игра загрузилась");
	g.step(5);
	g.dev.newGame();
	g.step(2);
	return g;
}
const stateErrs = (g) => g.dev.errs().filter((e) => e.kind === "state");

test("каждый экран достижим из меню по таблице переходов", async () => {
	const g = await game();
	const names = g.dev.run("JSON.stringify(SCREEN_NAMES)");
	const list = JSON.parse(names);
	assert.equal(list.length, 12);
	// обход графа переходов в ширину — каждый экран должен быть достижим из меню
	const seen = new Set(["menu"]),
		queue = ["menu"];
	while (queue.length) {
		const from = queue.shift();
		for (const to of list) {
			if (!seen.has(to) && g.dev.run(`Machine.can(${JSON.stringify(from)}, ${JSON.stringify(to)})`)) {
				seen.add(to);
				queue.push(to);
			}
		}
	}
	assert.deepEqual([...seen].sort(), [...list].sort(), "недостижимые экраны: " + list.filter((n) => !seen.has(n)).join(", "));
	// и реальный путь через go(): новая партия → карта → бой → награда → лавка → карта → настройки → назад
	for (const [to, why] of [
		["pick", "новая игра"],
		["map", "в поход"],
		["prep", "узел боя"],
		["fight", "в бой"],
		["msg", "награда"],
		["shop", "лавка арены"],
		["map", "в путь"],
		["settings", "пауза → настройки"],
		["map", "назад"],
		["menu", "сохранить и выйти"],
		["codex", "коллекция"],
		["menu", "назад"],
	]) {
		assert.equal(g.dev.run(`Machine.go(${JSON.stringify(to)})`), true, why + ": " + to);
		assert.equal(g.dev.S, to);
		g.step(1);
	}
	assert.equal(stateErrs(g).length, 0, "допустимые переходы не попадают в журнал");
	assert.equal(g.fatal, null);
});

test("недопустимый переход отклоняется, пишется в журнал и не меняет экран", async () => {
	const g = await game();
	assert.equal(g.dev.S, "menu");
	assert.equal(g.dev.run('Machine.go("fight")'), false, "из меню сразу в бой нельзя");
	assert.equal(g.dev.S, "menu", "экран не изменился");
	assert.equal(g.dev.run('Machine.go("codex") && Machine.go("map")'), false, "из коллекции на карту нельзя");
	assert.equal(g.dev.S, "codex");
	const errs = stateErrs(g);
	assert.equal(errs.length, 2);
	assert.match(errs[0].msg, /menu → fight/);
	assert.match(errs[1].msg, /codex → map/);
	assert.equal(g.dev.run("Machine.rejected"), 2);
	// отклонённые переходы — не серия сбоев кадра: аварийное окно не открывается
	g.step(3);
	assert.equal(g.dev.crash(), false);
	// меню доступно отовсюду (пауза → «В меню», аварийное окно)
	assert.equal(g.dev.run('Machine.go("menu")'), true);
});

test("S остаётся алиасом: прямое присваивание получает те же enter/exit", async () => {
	const g = await game();
	g.dev.S = "map"; // как это делает старый код или правка ИИ
	g.step(1);
	assert.equal(g.dev.run("lastS"), "map", "смена экрана зафиксирована в начале кадра");
	assert.equal(g.dev.run("Machine.prev"), "menu");
	// таймеры и слушатели, принадлежащие экрану, снимаются при выходе с него
	g.dev.run('Timers.every(10, () => {}, "screen:map")');
	assert.equal(g.dev.run('Timers.count("screen:map")'), 1);
	assert.equal(g.dev.run('Machine.go("shop")'), true);
	g.step(1);
	assert.equal(g.dev.run('Timers.count("screen:map")'), 0, "таймер карты снят при выходе");
	// enter-хук финального экрана: ENDT = время входа
	g.dev.S = "lose";
	g.step(1);
	assert.equal(g.dev.run("ENDT === t"), true);
	g.step(2);
	assert.equal(g.dev.run("ENDT < t"), true);
	// путь переходов есть в аварийном отчёте
	const rep = JSON.parse(g.dev.run("errReport()"));
	assert.ok(Array.isArray(rep.screens) && rep.screens.some((s) => s.startsWith("map>shop@")), JSON.stringify(rep.screens));
});

test("слои ввода: модальный слой перекрывает цели под ним; вторичные касания не считаются", async () => {
	const g = await game();
	const r = g.dev.run(`(() => {
		Input.begin();
		let low = 0, top = 0;
		area(0, 0, 200, 200, () => low++);
		Input.layer();
		area(0, 0, 50, 50, () => top++);
		const a = Input.pick(100, 100), b = Input.pick(10, 10);
		if (b) b.f(10, 10);
		return JSON.stringify({ a: a === null, b: !!b, low, top, layers: Input.layers, n: hits.length });
	})()`);
	assert.deepEqual(JSON.parse(r), { a: true, b: true, low: 0, top: 1, layers: 1, n: 1 });
	// второй палец при удержанном первом — не нажатие
	const m = g.dev.run(`(() => {
		innerWidth = 1218; innerHeight = 540; // окно = холст, координаты события = координаты холста
		const taps0 = Input.taps, ign0 = Input.ignored;
		Input.down({ isPrimary: false, pointerId: 2, clientX: 10, clientY: 10 });
		Input.down({ isPrimary: true, pointerId: 1, clientX: 10, clientY: 10 });
		const held = Input.active.size;
		Input.release({ pointerId: 1 });
		return JSON.stringify({ ignored: Input.ignored - ign0, taps: Input.taps - taps0, held, after: Input.active.size });
	})()`);
	assert.deepEqual(JSON.parse(m), { ignored: 1, taps: 1, held: 1, after: 0 });
	assert.equal(g.fatal, null);
});

test("lp(e): поворот экрана и letterbox-поля переводятся в координаты холста", async () => {
	const g = await game();
	const r = g.dev.run(`(() => {
		const out = {};
		innerWidth = 1218; innerHeight = 540;
		out.land = lp({ clientX: 609, clientY: 270 });
		innerWidth = 2436; innerHeight = 1080; // масштаб x2
		out.big = lp({ clientX: 2436, clientY: 1080 });
		innerWidth = 1218; innerHeight = 1000; // поля сверху и снизу по 230 px
		out.box = lp({ clientX: 0, clientY: 230 });
		innerWidth = 540; innerHeight = 1218; // портрет: холст повёрнут на 90°
		out.port = lp({ clientX: 540, clientY: 0 });
		out.portC = lp({ clientX: 270, clientY: 609 });
		innerWidth = 1218; innerHeight = 540;
		return JSON.stringify(out);
	})()`);
	const o = JSON.parse(r);
	assert.deepEqual(o.land, [609, 270]);
	assert.deepEqual(o.big, [1218, 540]);
	assert.deepEqual(o.box, [0, 0]);
	assert.deepEqual(o.port, [0, 0], "верхний правый угол телефона в портрете = левый верхний угол холста");
	assert.deepEqual(o.portC, [609, 270]);
});
