// Этап L: функции, вынесенные из длинных (dMap, dSet, bakeDecor, mkArena, dPop, saveDialog).
// Каждая проверяется отдельно: что рисует (журнал команд холста), что возвращает, какие зоны нажатия ставит.
import test from "node:test";
import assert from "node:assert/strict";
import { createDom } from "../harness/dom.mjs";
import { recorder, drawnTexts, count } from "../harness/record.mjs";
import { boot } from "../harness/boot.mjs";

// игра с записывающими холстами; отряд из четырёх героев, экран карты
async function game(screen = "map") {
	const r = recorder();
	const g = boot({ dom: createDom({ canvasFactory: r.canvasFactory }) });
	assert.ok(await g.ready(), "игра загрузилась");
	g.step(5);
	g.dev.seed(7);
	g.dev.newGame();
	for (let i = 0; i < 4; i++) g.dev.setSlot(i, g.dev.HEROES[i]);
	if (screen) g.dev.S = screen;
	g.step(2);
	// записать команды холста, которые выполнит выражение
	const rec = (code) => {
		r.log.lines = [];
		r.log.on = true;
		try {
			g.dev.run(code);
		} finally {
			r.log.on = false;
		}
		return r.log.lines;
	};
	const json = (code) => JSON.parse(g.dev.run("JSON.stringify(" + code + ")"));
	return { g, rec, json };
}
const hitsLen = (g) => g.dev.hits.length;

/* ---------- dMap ---------- */
test("dMapWater: без озёр ничего не рисует; с озером — блики 6×2 только при яркой фазе", async () => {
	const { g, rec } = await game();
	g.dev.run("MAPL = []");
	assert.equal(rec("dMapWater()").length, 0);
	g.dev.run("MAPL = [[100, 100, 60, 30], [300, 120, 80, 40]]");
	// за полный период синуса хотя бы один блик обязательно виден
	let seen = 0;
	for (let i = 0; i < 12; i++) {
		g.step(1);
		const lines = rec("dMapWater()");
		assert.equal(lines.filter((l) => /fillRect\(/.test(l)).length * 2, lines.length, "каждому блику — свой цвет (fillStyle + fillRect)");
		for (const l of lines) if (/fillRect\(/.test(l)) assert.match(l, /,6,2\)$/, "блик 6×2");
		seen += lines.length;
	}
	assert.ok(seen > 0, "блики были");
});

test("dMapPaths: по два квадрата на огонёк только к доступным узлам; во время перехода (MV) — ничего", async () => {
	const { g, rec, json } = await game();
	const av = json("avail()");
	assert.ok(av.length > 0, "из лагеря есть куда идти");
	const lines = rec("dMapPaths(avail())");
	const rects = lines.filter((l) => /fillRect\(/.test(l));
	assert.ok(rects.length >= 2 * av.length, "хотя бы один огонёк на путь");
	assert.equal(rects.length % 2, 0, "тёмная подложка + светлый центр");
	// каждый огонёк лежит на отрезке к одному из доступных узлов (с запасом на округление к сетке 2 px)
	const N = json("N"),
		cur = json("G.cur");
	for (let i = 0; i < rects.length; i += 2) {
		const m = /fillRect\((-?\d+),(-?\d+),8,8\)/.exec(rects[i]);
		assert.ok(m, rects[i]);
		const px = +m[1] + 4,
			py = +m[2] + 4 - 6;
		const onSeg = av.some((b) => {
			const A = N[cur],
				B = N[b],
				l = Math.hypot(B.x - A.x, B.y - A.y),
				tt = ((px - A.x) * (B.x - A.x) + (py - A.y) * (B.y - A.y)) / (l * l);
			return tt > 0 && tt < 1 && Math.hypot(A.x + (B.x - A.x) * tt - px, A.y + (B.y - A.y) * tt - py) < 3;
		});
		assert.ok(onSeg, "огонёк на пути: " + rects[i]);
	}
	assert.equal(rec("dMapPaths([])").length, 0);
	g.dev.run("MV = { a: 0, b: 1, t0: t, d: 0.55 }");
	assert.equal(rec("dMapPaths(avail())").length, 0, "в пути огоньки не рисуются");
	g.dev.run("MV = null");
});

test("dMapNode: значок, подпись по виду узла, одна зона нажатия; доступный узел ведёт в путь, недоступный — показывает подсказку", async () => {
	const { g, rec, json } = await game();
	const av = json("avail()"),
		N = json("N");
	// лагерь (узел 0, текущий): без подписи, но с зоной нажатия
	const h0 = hitsLen(g);
	const lines0 = rec("dMapNode(N[0], 0, avail(), WORLDS[G.w])");
	assert.equal(hitsLen(g) - h0, 1);
	assert.ok(count(lines0, "drawImage") >= 1, "значок лагеря нарисован");
	// доступный узел: подпись из NODE_LB (или имя босса) и подсветка
	const i = av[0],
		kind = g.dev.run(`nodeKind(N[${i}], ${i})`),
		label = g.dev.run(`${JSON.stringify(kind)} === "boss" ? WORLDS[G.w].boss.n : NODE_LB[${JSON.stringify(kind)}]`);
	const lines = rec(`dMapNode(N[${i}], ${i}, avail(), WORLDS[G.w])`);
	if (label) assert.ok(drawnTexts(lines).includes(label), "подпись «" + label + "»");
	assert.ok(count(lines, "drawImage") >= 1);
	// нажатие на доступный узел начинает переход
	const hit = g.dev.hits[g.dev.hits.length - 1];
	assert.equal(g.dev.run("MV"), null);
	hit.f();
	const mv = json("MV");
	assert.equal(mv && mv.b, i, "переход к выбранному узлу");
	g.dev.run("MV = null");
	// нажатие на недоступный узел — подсказка TIPN
	const far = N.findIndex((n, k) => k !== 0 && !av.includes(k));
	rec(`dMapNode(N[${far}], ${far}, avail(), WORLDS[G.w])`);
	g.dev.hits[g.dev.hits.length - 1].f();
	assert.equal(json("TIPN").i, far);
	assert.equal(g.dev.run("MV"), null);
});

test("dMapParty: тень + боец + флажок на узле; в пути — шаг без флажка и с пылью", async () => {
	const { g, rec } = await game();
	const still = rec("dMapParty(G.slots.find(Boolean))");
	assert.equal(count(still, "ellipse"), 1, "одна тень");
	assert.equal(count(still, "rotate"), 1, "флажок (стрелка повёрнута вниз)");
	assert.ok(count(still, "drawImage") >= 2, "боец и стрелка");
	g.dev.run("MV = { a: G.cur, b: avail()[0], t0: t - 0.2, d: 0.55 }");
	const parts0 = g.dev.run("Parts.a.length");
	let dust = 0;
	for (let i = 0; i < 20; i++) {
		const walk = rec("dMapParty(G.slots.find(Boolean))");
		assert.equal(count(walk, "ellipse"), 1);
		assert.equal(count(walk, "rotate"), 0, "в пути флажка нет");
		dust = g.dev.run("Parts.a.length") - parts0;
	}
	assert.ok(dust > 0, "пыль из-под ног появилась");
	g.dev.run("MV = null");
});

test("dMapHud: заголовок мира, шкала шагов до босса, магазин, подсказка узла", async () => {
	const { g, rec, json } = await game();
	const w = json("WORLDS[G.w]"),
		N = json("N");
	const lines = rec("dMapHud(WORLDS[G.w])");
	const texts = drawnTexts(lines);
	assert.ok(texts.includes("Мир 1 · " + w.n), texts.join(" | "));
	const steps = N[N.length - 1].ly || 1;
	const scale = lines.filter((l) => /fillRect\(-?\d+,(46|48),/.test(l));
	assert.equal(scale.length, 2 * (steps + 1), "по два квадрата на шаг");
	// подсказка по узлу: имя и описание
	const i = N.findIndex((n, k) => k > 0);
	g.dev.run(`TIPN = { i: ${i}, t0: t }`);
	const kind = g.dev.run(`nodeKind(N[${i}], ${i})`);
	const tipTexts = drawnTexts(rec("dMapHud(WORLDS[G.w])"));
	const name = g.dev.run(`${JSON.stringify(kind)} === "boss" ? WORLDS[G.w].boss.n : NODE_LB[${JSON.stringify(kind)}] || "Неизвестность"`);
	assert.ok(tipTexts.includes(name), "подсказка «" + name + "» в " + tipTexts.join(" | "));
	g.dev.run("TIPN = null");
	// dMap целиком: ровно те же части в том же порядке (вода → пути → узлы → отряд → интерфейс)
	const all = rec("dMap()");
	assert.ok(all.length > lines.length);
	assert.equal(all[0].slice(all[0].indexOf(".")), lines.length ? ".drawImage" + all[0].split(".drawImage")[1] : all[0], "первой идёт готовая земля");
});

/* ---------- dSet ---------- */
test("setAudioRows/setGameRows: 3 + 5 строк, подписи и действия", async () => {
	const { g, json } = await game("settings");
	assert.deepEqual(
		json("setAudioRows().map((r) => r[0])"),
		["Музыка", "Громкость музыки", "Громкость звуков"]
	);
	assert.deepEqual(
		json("setGameRows().map((r) => r[0])"),
		["Графика", "Тряска экрана", "Ульты героев", "Счётчик FPS", "Сохранение"]
	);
	// действия меняют настройку и значение в следующей строке
	const on = g.dev.run("Music.on");
	g.dev.run("setAudioRows()[0][2]()");
	assert.equal(g.dev.run("Music.on"), !on);
	g.dev.run("setAudioRows()[0][2]()");
	assert.equal(g.dev.run("Music.on"), on);
	const vol = g.dev.run("Music.vol");
	g.dev.run("setAudioRows()[1][2]()");
	assert.notEqual(g.dev.run("Music.vol"), vol);
	const shake = g.dev.run("CFG.shake !== false");
	g.dev.run("setGameRows()[1][2]()");
	assert.equal(g.dev.run("CFG.shake !== false"), !shake);
	assert.equal(g.dev.run("setGameRows()[1][1]"), shake ? "Выкл" : "Вкл");
	g.dev.run("setGameRows()[1][2]()");
	// удаление сохранения: без сохранения — «Нет» и кнопка ничего не делает; с сохранением — сначала вопрос
	g.dev.delSave();
	assert.equal(g.dev.run("setGameRows()[4][1]"), "Нет");
	g.dev.run("setGameRows()[4][2]()");
	assert.equal(g.dev.run("delAsk"), false);
	g.dev.S = "map";
	assert.equal(g.dev.saveGame(), true);
	assert.equal(g.dev.run("setGameRows()[4][1]"), "Удалить");
	g.dev.run("setGameRows()[4][2]()");
	assert.equal(g.dev.run("setGameRows()[4][1]"), "Точно удалить?");
	g.dev.run("setGameRows()[4][2]()");
	assert.equal(g.dev.run("SAVED"), false);
	assert.equal(g.dev.run("delAsk"), false);
	// экран настроек рисуется из этих строк: все подписи на холсте
	const { rec } = await game("settings");
	const texts = drawnTexts(rec("dSet()"));
	for (const lb of ["Музыка", "Громкость музыки", "Громкость звуков", "Графика", "Тряска экрана", "Ульты героев", "Счётчик FPS", "Сохранение", "Назад", "Экспорт", "Импорт"]) assert.ok(texts.includes(lb), lb);
});

/* ---------- bakeDecor ---------- */
const bakeJ = 'var __J = (() => { const w = WORLDS[0]; return { x: mkC(609, 270).getContext("2d"), im: mapImg(w), AM: ATL.map, R: rng32(42), P: MAPT[w.id], seed: 42 }; })()';

test("bakeLakes: 1–2 озера вдали от дорог и узлов попадают в MAPL; у дороги озеро не ставится", async () => {
	const { g, rec, json } = await game();
	g.dev.run(bakeJ);
	const lines = rec("bakeLakes(__J.x, __J.im, __J.AM, __J.R, () => 1e9, () => 1e9)");
	const lakes = json("MAPL");
	assert.ok(lakes.length >= 1 && lakes.length <= 2, "озёр " + lakes.length);
	assert.equal(count(lines, "drawImage"), lakes.length, "по одному рисунку на озеро");
	for (const q of lakes) {
		assert.ok(q[0] >= 40 && q[0] + q[2] <= 569 && q[1] >= 56 && q[1] + q[3] <= 206, "в поле карты: " + q);
	}
	if (lakes.length === 2) assert.ok(Math.abs(lakes[0][0] - lakes[1][0]) >= 110 || Math.abs(lakes[0][1] - lakes[1][1]) >= 60, "не вплотную");
	// всё — дорога: ни одного озера, MAPL пуст
	const none = rec("bakeLakes(__J.x, __J.im, __J.AM, rng32(42), () => 0, () => 1e9)");
	assert.equal(count(none, "drawImage"), 0);
	assert.deepEqual(json("MAPL"), []);
	g.dev.bakeMap(1);
});

test("bakeRoads: кайма и пунктир по пикселям вдоль каждого ребра, две площадки-эллипса на узел", async () => {
	const { g, rec } = await game();
	g.dev.run(bakeJ);
	const lines = rec("bakeRoads(__J.x, __J.P, [[0, 10, 100, 10]], [[50, 50], [80, 60]])");
	// 101 шаг каймы + пунктир: шаги, у которых ((s/4)|0) % 3 !== 2
	let dash = 0;
	for (let s = 0; s <= 100; s++) if (((s / 4) | 0) % 3 !== 2) dash++;
	assert.equal(count(lines, "fillRect"), 101 + dash);
	assert.equal(count(lines, "ellipse"), 4);
	assert.equal(lines.filter((l) => /fillRect\(-?\d+,-?\d+,5,4\)/.test(l)).length, 101, "кайма 5×4");
	assert.equal(lines.filter((l) => /fillRect\(-?\d+,-?\d+,3,2\)/.test(l)).length, dash, "пунктир 3×2");
	const empty = rec("bakeRoads(__J.x, __J.P, [], [])");
	assert.equal(count(empty, "fillRect") + count(empty, "ellipse"), 0, "без рёбер и узлов ничего не рисуется");
});

test("bakeForest: деревья и мелочи — детерминированно по R, порциями как целиком, снизу вверх, не на дорогах и не в озёрах", async () => {
	const { g, rec, json } = await game();
	g.dev.run(bakeJ + "; MAPL = [[200, 100, 80, 40]]");
	// лес целиком за один вызов и порциями по FOREST_CHUNK (как в bakeStep) — одни и те же команды
	const forest = (chunk) => `(() => { __J.R = rng32(5); __J.roadD = () => 1e9; __J.nodeD = () => 1e9; __J.items = []; for (let i = 0; i < FOREST_N; i += ${chunk}) bakeForest(__J, i, Math.min(FOREST_N, i + ${chunk})); bakeForestDraw(__J); })()`;
	const a = rec(forest("FOREST_N"));
	const b = rec(forest("FOREST_CHUNK"));
	assert.deepEqual(a, b, "одинаковый R — одинаковый лес, нарезка не влияет");
	const n = count(a, "drawImage");
	assert.ok(n > 20, "лес не пустой: " + n);
	assert.equal(count(a, "ellipse"), n, "у каждого предмета своя тень");
	assert.equal(json("__J.items.length"), n, "в J.items — ровно отрисованные предметы");
	// центры теней идут по возрастанию y (рисуем снизу вверх по глубине)
	const ys = a.filter((l) => /\.ellipse\(/.test(l)).map((l) => +l.split("(")[1].split(",")[1]);
	for (let i = 1; i < ys.length; i++) assert.ok(ys[i] >= ys[i - 1], "порядок по y");
	// ничего внутри озера
	for (const l of a.filter((l) => /\.drawImage\(/.test(l))) {
		const p = l.split("(")[1].split(",");
		const dx = +p[5] + +p[3] / 2,
			dy = +p[6] + +p[4];
		assert.ok(!(dx > 194 && dx < 286 && dy > 98 && dy < 152), "предмет в озере: " + l);
	}
	// всё — дорога: леса нет
	assert.equal(count(rec("__J.R = rng32(5); __J.roadD = () => 0; __J.items = []; bakeForest(__J, 0, FOREST_N); bakeForestDraw(__J)"), "drawImage"), 0);
	g.dev.bakeMap(1);
});

test("bakeStep: декор идёт этапами между кадрами (озёра → дороги → лес порциями → отрисовка), прогресс растёт до 1", async () => {
	// нулевой бюджет: ровно одна порция работы за кадр. Часы заглушки DOM идут с шагом 1 мс,
	// поэтому с бюджетом 0,2 мс дешёвый этап озёр иногда проскакивал вместе с дорогами в одном кадре
	const g = boot({ bakeMs: 0 });
	assert.ok(await g.ready());
	g.step(3);
	g.dev.seed(99);
	g.dev.newGame();
	g.dev.S = "map";
	while (g.dev.run("MAPJ && MAPJ.py < 270")) g.step(1);
	const stages = [],
		prog = [];
	while (g.dev.run("!!MAPJ")) {
		stages.push(g.dev.run("MAPJ.stage + ':' + MAPJ.fi"));
		prog.push(g.dev.run("bakeProgress()"));
		g.step(1);
	}
	assert.ok(stages.length >= 6, "декор занял " + stages.length + " кадров — должен быть разложен на несколько");
	const seq = stages.map((s) => s.split(":").map(Number));
	for (let i = 1; i < seq.length; i++) assert.ok(seq[i][0] > seq[i - 1][0] || (seq[i][0] === seq[i - 1][0] && seq[i][1] >= seq[i - 1][1]), "этапы и кандидаты не убывают: " + stages.join(" "));
	const forest = seq.filter((q) => q[0] === 2).map((q) => q[1]);
	assert.ok(forest.length >= 4, "лес шёл порциями между кадрами: " + stages.join(" "));
	for (let i = 1; i < forest.length; i++) assert.equal(forest[i] - forest[i - 1], 150, "порция леса = FOREST_CHUNK");
	assert.ok(seq.some((q) => q[0] === 1) && seq.some((q) => q[0] === 3), "видны этапы дорог и отрисовки леса: " + stages.join(" "));
	assert.ok(!seq.some((q) => q[0] === 4), "после последнего этапа карта готова в том же кадре");
	for (let i = 1; i < prog.length; i++) assert.ok(prog[i] >= prog[i - 1] && prog[i] < 1, "прогресс не убывает и < 1 до готовности");
	assert.equal(g.dev.run("bakeProgress()"), 1);
	assert.equal(g.dev.run("MAPK"), g.dev.run("SD + ':' + G.w"));
	assert.equal(g.dev.run("JSON.stringify(MAPL.map((q) => q.map((v) => +v.toFixed(2))))"), "[[200.19,161.45,44,33]]", "озеро там же, где его ставила цельная сборка");
	assert.equal(g.dev.errs().length, 0);
});

/* ---------- mkArena ---------- */
const arenaA = (seed, kind = "norm") => `var __A = (() => { const w = WORLDS[0], A = { seed: ${seed}, wi: 0, w, y0: w.fy0, obs: [], dec: [], patches: [], pools: [], gv: 0, nf: new Map(), em: {}, ev: 3, kind: ${JSON.stringify(kind)}, tod: 0 }; return A; })(); var __R = rng32(${seed}); var __cy = (__A.w.fy0 + FLD.y1) / 2; var __hh = (FLD.y1 - __A.w.fy0) / 2; __A`;

test("arenaCand: босс — всегда «кольцо» из 4; иначе схема из списка; свет и разрушаемое есть всегда", async () => {
	const { g, json } = await game(null);
	const kinds = (c) => c.map((q) => q[2]);
	g.dev.run(arenaA(3, "boss"));
	const boss = json("arenaCand(__A, __R, 'boss', 609, __cy, __hh)");
	assert.equal(g.dev.run("__A.lay"), "ring");
	assert.equal(kinds(boss).filter((k) => k === "B" || k === "S").length, 4);
	assert.ok(kinds(boss).includes("L") && kinds(boss).includes("D"));
	const lays = new Set();
	for (let s = 1; s <= 30; s++) {
		g.dev.run(arenaA(s));
		const c = json("arenaCand(__A, __R, 'norm', 609, __cy, __hh)");
		lays.add(g.dev.run("__A.lay"));
		assert.ok(c.length >= 3, "кандидатов " + c.length);
		for (const [x, y, k] of c) {
			assert.ok("BSLD".includes(k), k);
			assert.ok(x > 100 && x < 1120 && y >= json("__A.y0") - 1 && y <= json("FLD.y1") + 1, "в поле: " + [x, y, k]);
		}
		assert.ok(kinds(c).filter((k) => k === "D").length >= 1 && kinds(c).filter((k) => k === "L").length >= 1);
	}
	assert.ok(lays.size >= 4, "разные схемы за 30 сидов: " + [...lays]);
});

test("arenaObstacles: без наложений, в границах поля, проход между сторонами есть", async () => {
	const { g, json } = await game(null);
	for (let s = 1; s <= 12; s++) {
		g.dev.run(arenaA(s));
		g.dev.run("arenaObstacles(__A, __R, arenaCand(__A, __R, 'norm', 609, __cy, __hh), __cy)");
		const obs = json("__A.obs.map((o) => [o.x, o.y, o.rx, o.ry, o.spr])");
		for (let i = 0; i < obs.length; i++) {
			assert.ok(obs[i][0] >= 170 && obs[i][0] <= 1050, "x в поле");
			for (let j = 0; j < i; j++) {
				const a = obs[i],
					b = obs[j];
				assert.ok(!(Math.abs(a[0] - b[0]) / (a[2] + b[2] + 34) < 1 && Math.abs(a[1] - b[1]) / (a[3] + b[3] + 30) < 1), "наложение " + a + " / " + b);
			}
		}
		assert.equal(g.dev.run("navReach(__A, 150, __cy, 1070, __cy)"), true, "проход есть (сид " + s + ")");
		assert.ok(g.dev.run("__A.cols > 0 && __A.rows > 0"), "сетка построена");
	}
});

test("arenaPatches и arenaDecor: количество в пределах, без наложений, декор не на препятствиях", async () => {
	const { g, json } = await game(null);
	for (let s = 1; s <= 12; s++) {
		g.dev.run(arenaA(s));
		g.dev.run("arenaObstacles(__A, __R, arenaCand(__A, __R, 'norm', 609, __cy, __hh), __cy); arenaPatches(__A, __R); arenaDecor(__A, __R)");
		const pt = json("__A.patches.map((p) => [p.x, p.y, p.rx, p.ry, p.k])");
		assert.ok(pt.length <= 4, "покрытий " + pt.length);
		for (let i = 0; i < pt.length; i++) {
			assert.ok(g.dev.run(`!!PATCH[${JSON.stringify(pt[i][4])}]`), "покрытие известно: " + pt[i][4]);
			for (let j = 0; j < i; j++) assert.ok(!(Math.abs(pt[i][0] - pt[j][0]) < pt[i][2] + pt[j][2] && Math.abs(pt[i][1] - pt[j][1]) < pt[i][3] + pt[j][3]), "покрытия наложились");
		}
		const dec = json("__A.dec.map((d) => [d.x, d.y, d.spr])"),
			obs = json("__A.obs.map((o) => [o.x, o.y, o.rx, o.ry])");
		assert.ok(dec.length <= 9, "декора " + dec.length);
		for (const d of dec) {
			assert.ok(g.dev.run(`!!ATL.props[${JSON.stringify(d[2])}]`), "спрайт есть: " + d[2]);
			for (const o of obs) assert.ok(!(Math.abs(o[0] - d[0]) < o[2] + 30 && Math.abs(o[1] - d[1]) < o[3] + 16), "декор на препятствии");
		}
	}
	// mkArena целиком детерминирован по сиду
	const one = json('(() => { const A = mkArena(77, 0, "norm"); return [A.lay, A.tod, A.wx, A.obs.map((o) => [o.spr, o.x, o.y]), A.patches.map((p) => [p.k, p.x, p.y]), A.dec.map((d) => [d.spr, d.x, d.y]), A.tw]; })()');
	const two = json('(() => { const A = mkArena(77, 0, "norm"); return [A.lay, A.tod, A.wx, A.obs.map((o) => [o.spr, o.x, o.y]), A.patches.map((p) => [p.k, p.x, p.y]), A.dec.map((d) => [d.spr, d.x, d.y]), A.tw]; })()');
	assert.deepEqual(one, two);
	assert.equal(one[6].length, 14, "14 искр фона");
});

/* ---------- dPop ---------- */
test("popHeight: враг — фиксированная, босс выше; свой боец — под описания, не ниже минимума и не выше экрана", async () => {
	const { g } = await game();
	assert.equal(g.dev.run('popHeight({ team: 1 }, null, false, 372, 84)'), 214);
	assert.equal(g.dev.run('popHeight({ team: 1, boss: 1 }, null, false, 372, 84)'), 262);
	for (let i = 0; i < 4; i++) {
		const own = g.dev.run(`popHeight(G.slots[${i}], KIT[G.slots[${i}].k], false, 372, 84)`),
			mine = g.dev.run(`popHeight(G.slots[${i}], KIT[G.slots[${i}].k], true, 372, 84)`);
		assert.ok(own >= 300 && own <= 540 - 84 - 26, "не свой: " + own);
		assert.ok(mine >= 348 && mine >= own && mine <= 540 - 84 - 26, "свой (с кнопкой): " + mine);
	}
});

test("dPopHead: имя, редкость и роль у своего; тип и стихия у врага", async () => {
	const { g, rec } = await game();
	const own = drawnTexts(rec("dPopHead(G.slots[0], KIT[G.slots[0].k], 826, 84, 0)"));
	const u = JSON.parse(g.dev.run("JSON.stringify({ n: G.slots[0].n, r: RAR[G.slots[0].r || 0].n, role: KIT[G.slots[0].k].role })"));
	assert.ok(own.includes(u.n), own.join(" | "));
	assert.ok(own.includes(u.r));
	assert.ok(own.some((s) => s.startsWith(u.role + " · ур. ")));
	const foe = drawnTexts(rec('dPopHead({ ...foeDef(0, "b"), team: 1 }, null, 826, 84, 0)'));
	assert.ok(foe.includes("Элита"), foe.join(" | "));
	assert.ok(foe.some((s) => s.startsWith("Стихия: ")));
	const boss = drawnTexts(rec('dPopHead({ ...foeDef(1, "boss"), team: 1 }, null, 826, 84, 0)'));
	assert.ok(boss.includes("Босс мира") && boss.includes(g.dev.run("WORLDS[1].boss.n")));
	// вспышка повышения — свечение
	assert.ok(count(rec("dPopHead(G.slots[0], KIT[G.slots[0].k], 826, 84, 0.5)"), "drawImage") > count(rec("dPopHead(G.slots[0], KIT[G.slots[0].k], 826, 84, 0)"), "drawImage"));
});

test("dPopStats: шесть характеристик с подписями и значениями; при повышении здоровье и атака зелёные", async () => {
	const { g, rec } = await game();
	const lines = rec("dPopStats(G.slots[1], 826, 84, 0)");
	const texts = drawnTexts(lines);
	for (const lb of ["Здоровье", "Атака", "Темп", "Броня", "Дальность", "Скорость"]) assert.ok(texts.includes(lb), lb);
	const u = JSON.parse(g.dev.run("JSON.stringify({ hp: G.slots[1].hp, max: G.slots[1].max, atk: G.slots[1].atk, arm: G.slots[1].arm })"));
	assert.ok(texts.includes(g.dev.run("fmt(" + Math.max(0, Math.round(u.hp)) + ') + " / " + fmt(' + u.max + ")")));
	assert.ok(texts.includes(String(u.arm)));
	const green = (ls) => ls.filter((l) => /fillStyle="#aaff9a"/.test(l)).length;
	assert.equal(green(lines), 0);
	assert.equal(green(rec("dPopStats(G.slots[1], 826, 84, 0.7)")), 2);
});

test("dPopBody: навык и ульта с кнопкой «Накормить» у своего; подсказка без кнопок у врага; в коллекции — «Просмотр анимаций»", async () => {
	const { g, rec } = await game();
	g.dev.labelButtons();
	const h0 = hitsLen(g);
	const own = drawnTexts(rec("dPopBody(G.slots[0], KIT[G.slots[0].k], true, 826, 84, 372, 360)"));
	const K = JSON.parse(g.dev.run("JSON.stringify({ ab: KIT[G.slots[0].k].ab.n, ult: KIT[G.slots[0].k].ult.n })"));
	assert.ok(own.includes(K.ab) && own.includes("Ульта: " + K.ult), own.join(" | "));
	assert.equal(hitsLen(g) - h0, 1, "одна кнопка");
	assert.ok(g.dev.findHit("Накормить"), "кнопка кормления");
	// не свой (чужой экран/в бою) — без кнопки
	const h1 = hitsLen(g);
	rec("dPopBody(G.slots[0], KIT[G.slots[0].k], false, 826, 84, 372, 300)");
	assert.equal(hitsLen(g) - h1, 0);
	// враг — подсказка, кнопок нет
	const h2 = hitsLen(g);
	const foe = drawnTexts(rec('dPopBody({ ...foeDef(0, "m"), team: 1 }, null, false, 826, 84, 372, 214)'));
	assert.ok(foe.some((s) => /Плюётся/.test(s)), foe.join(" | "));
	assert.equal(hitsLen(g) - h2, 0);
	const bossTip = drawnTexts(rec('dPopBody({ ...foeDef(0, "boss"), team: 1 }, null, false, 826, 84, 372, 262)'));
	assert.ok(bossTip.some((s) => /метка/.test(s)));
	// коллекция: кнопка просмотра анимаций
	g.dev.S = "codex";
	rec("dPopBody(G.slots[0], KIT[G.slots[0].k], true, 826, 84, 372, 360)");
	assert.ok(g.dev.findHit("Просмотр анимаций"));
	// dPop целиком: шапка + характеристики + низ, закрытие по нажатию мимо
	g.dev.S = "map";
	g.dev.pop = { u: g.dev.G.slots[0], mine: true };
	const h3 = hitsLen(g);
	const all = drawnTexts(rec("dPop()"));
	assert.ok(all.includes("Здоровье") && all.includes("Ульта: " + K.ult));
	assert.equal(hitsLen(g) - h3, 3, "фон-закрытие, панель, кнопка");
	g.dev.hits[h3].f();
	assert.equal(g.dev.pop, null);
});

/* ---------- saveDialog ---------- */
test("saveDialogHtml: экспорт — скачать/копировать и поле только для чтения; импорт — выбор файла и «Загрузить»", async () => {
	const { g } = await game();
	const exp = g.dev.run("saveDialogHtml(true)"),
		imp = g.dev.run("saveDialogHtml(false)");
	assert.match(exp, /Экспорт сохранения/);
	assert.ok(exp.includes('id="mx-save-dl"') && exp.includes('id="mx-save-copy"') && exp.includes('id="mx-save-close"'));
	assert.ok(!exp.includes("mx-save-file") && !exp.includes("mx-save-load"));
	assert.match(exp, /<textarea id="mx-save-text" readonly /);
	assert.match(imp, /Импорт сохранения/);
	assert.ok(imp.includes('id="mx-save-file"') && imp.includes('id="mx-save-load"') && imp.includes('id="mx-save-close"'));
	assert.ok(!imp.includes("mx-save-dl") && !imp.includes("readonly"));
	assert.match(imp, /мир|резерв/);
});

const fakeUi = 'var __els = {}; var __said = []; var __$ = (id) => (__els[id] = __els[id] || { style: {}, value: "", focus() {}, select() {} }); var __say = (m, ok) => __said.push([m, !!ok]);';

test("saveDialogExport: текст сохранения в поле; без сохранения — предупреждение; скачивание и копирование не роняют игру", async () => {
	const { g, json } = await game();
	g.dev.delSave();
	g.dev.run(fakeUi + " saveDialogExport(__$, __say)");
	assert.equal(g.dev.run('__els["mx-save-text"].value'), "");
	assert.match(json("__said")[0][0], /нечего экспортировать/);
	g.dev.run('__els["mx-save-dl"].onclick(); __els["mx-save-copy"].onclick()');
	assert.equal(json("__said").length, 1, "без текста кнопки молчат");
	assert.equal(g.dev.saveGame(), true);
	g.dev.run(fakeUi + " saveDialogExport(__$, __say)");
	const text = g.dev.run('__els["mx-save-text"].value');
	assert.equal(text, g.dev.run("exportSaveText()"));
	assert.equal(JSON.parse(text).v, 3);
	// скачивание в заглушке DOM не доступно (нет URL/Blob) — понятное сообщение, не исключение
	g.dev.run('__els["mx-save-dl"].onclick()');
	assert.match(json("__said").at(-1)[0], /скачан|скопируйте текст вручную/);
	g.dev.run('__els["mx-save-copy"].onclick()');
	assert.match(json("__said").at(-1)[0], /Скопировано|вручную/);
	assert.equal(g.fatal, null);
	assert.equal(g.dev.errs().length, 0);
});

test("saveDialogImport: «Загрузить» применяет текст, отвергает мусор; большой файл не читается", async () => {
	const { g, json } = await game();
	assert.equal(g.dev.saveGame(), true);
	const text = g.dev.run("exportSaveText()");
	g.dev.run(fakeUi + ' __els["mx-save-text"] = { style: {}, value: "" }; saveDialogImport(__$, __say)');
	g.dev.run('__els["mx-save-load"].onclick()');
	assert.match(json("__said").at(-1)[0], /Не загружено: .*пуст/);
	g.dev.run('__els["mx-save-text"].value = "мусор"; __els["mx-save-load"].onclick()');
	assert.match(json("__said").at(-1)[0], /Не загружено: .*JSON/);
	const coins = g.dev.run("G.coin");
	g.dev.run("G.coin = 999; saveGame()");
	g.dev.run("__els['mx-save-text'].value = " + JSON.stringify(text) + "; __els['mx-save-load'].onclick()");
	assert.match(json("__said").at(-1)[0], /^Сохранение загружено/);
	assert.equal(json("__said").at(-1)[1], true);
	// файл-обработчик: слишком большой файл отклоняется до чтения
	g.dev.run('__els["mx-save-file"].files = [{ size: 3000000 }]; __els["mx-save-file"].onchange()');
	assert.match(json("__said").at(-1)[0], /слишком большой/);
	// загруженное сохранение читается: монеты из экспортированного текста, а не 999
	g.dev.loadGame();
	assert.equal(g.dev.run("G.coin"), coins);
	assert.equal(g.fatal, null);
	assert.equal(g.dev.errs().length, 0);
});

/* ---------- второй проход: функции 60–80 строк ---------- */
test("crashHtml и crashWire: четыре кнопки; «Продолжить» снимает аварийный режим, «В меню» уводит из боя, отчёт копируется", async () => {
	const { g, json } = await game(null);
	const html = g.dev.run("crashHtml()");
	for (const id of ["mx-crash-msg", "mx-crash-go", "mx-crash-menu", "mx-crash-roll", "mx-crash-copy"]) assert.ok(html.includes('id="' + id + '"'), id);
	assert.match(html, /Что-то пошло не так/);
	assert.equal((html.match(/<button /g) || []).length, 4);
	// бой → аварийный режим → «В меню»
	g.dev.fight("norm");
	g.dev.autoPlace();
	g.dev.startFight();
	g.step(3);
	assert.equal(g.dev.S, "fight");
	g.dev.run('ERR_CRASH = true; ERR_STREAK = 3; var __removed = 0; var __wrap = { remove() { __removed++; } }; ' + fakeUi + " crashWire(__$, __wrap)");
	assert.equal(g.dev.crash(), true);
	g.dev.run('__els["mx-crash-menu"].onclick()');
	assert.equal(g.dev.S, "menu");
	assert.equal(g.dev.F, null);
	assert.equal(g.dev.paused, false);
	assert.equal(g.dev.crash(), false, "окно закрыто, аварийный режим снят");
	assert.equal(g.dev.run("ERR_STREAK"), 0);
	assert.equal(g.dev.run("__removed"), 1);
	// «Продолжить» — только закрыть
	g.dev.run("ERR_CRASH = true; ERR_STREAK = 3");
	g.dev.run('__els["mx-crash-go"].onclick()');
	assert.equal(g.dev.crash(), false);
	assert.equal(g.dev.run("__removed"), 2);
	// «Скопировать отчёт» — в заглушке без буфера обмена всё равно без исключения
	g.dev.run('__els["mx-crash-copy"].onclick()');
	assert.equal(g.dev.run('__els["mx-crash-copy"].textContent'), "Скопировано");
	assert.equal(g.fatal, null);
	void json;
});

// арена нужного мира (по id) — для тестов фона
const arenaOf = (id, extra = "") => `(() => { const wi = WORLDS.findIndex((w) => w.id === ${JSON.stringify(id)}); const A = mkArena(3, wi, "norm"); ${extra}; return A; })()`;

test("stageFog: туман только в тайге/болоте/мёртвых землях или при погоде «туман» — шесть полос и свечение", async () => {
	const { g, rec } = await game(null);
	g.dev.run("var __A = " + arenaOf("swamp", 'A.wx = "clear"'));
	const swamp = rec("stageFog(__A, fogSpr())");
	assert.equal(count(swamp, "drawImage"), 6 + 1, "6 полос тумана + свечение");
	g.dev.run("var __A = " + arenaOf("taiga", 'A.wx = "clear"'));
	assert.equal(count(rec("stageFog(__A, fogSpr())"), "drawImage"), 6, "в тайге без свечения");
	g.dev.run("var __A = " + arenaOf("desert", 'A.wx = "clear"'));
	assert.equal(rec("stageFog(__A, fogSpr())").length, 0, "в пустыне тумана нет");
	g.dev.run('__A.wx = "fog"');
	assert.ok(count(rec("stageFog(__A, fogSpr())"), "drawImage") >= 6, "погода «туман» — есть везде");
});

test("stageRays/stageFinal/stageWorldFx: у каждого мира своя особенность, все рисуются без ошибок", async () => {
	const { g, rec } = await game(null);
	const rays = rec("stageRays(228)");
	assert.equal(count(rays, "fill"), 4);
	assert.ok(rays.some((l) => /globalCompositeOperation="lighter"/.test(l)));
	assert.equal(count(rays, "save"), count(rays, "restore"));
	const fin = rec("stageFinal(240)");
	assert.equal(count(fin, "ellipse"), 1);
	assert.equal(count(fin, "stroke"), 1);
	assert.equal(count(fin, "createLinearGradient"), 1);
	const ids = JSON.parse(g.dev.run("JSON.stringify(WORLDS.map((w) => w.id))"));
	for (const id of ids) {
		g.dev.run("var __A = " + arenaOf(id, "A.tod = 0"));
		const lines = rec("stageWorldFx(__A)");
		if (id === "sky" || id === "desert" || id === "ice" || id === "fire") assert.ok(count(lines, "drawImage") >= 1, id + ": свечение");
		if (id === "chaos") assert.ok(lines.some((l) => /globalCompositeOperation="hue"/.test(l)), "хаос: перелив");
		if (id === "final") assert.equal(count(lines, "ellipse"), 1);
		if (id === "taiga") assert.equal(count(lines, "fill"), 4, "тайга на закате: лучи");
	}
	// stageFx целиком = туман + особенность + свечение покрытий
	g.dev.run("var __A = " + arenaOf("swamp", 'A.wx = "clear"; A.patches = [{ x: 500, y: 300, rx: 40, s: 1, P: { glow: "#3c8a50" } }]'));
	const all = rec("stageFx(__A)");
	assert.ok(count(all, "drawImage") >= 8, "туман (6) + свечение болота + свечение покрытия");
	assert.equal(g.dev.errs().length, 0);
});

// бой на экране: отряд расставлен, симуляция запущена
async function inFight(kind = "norm") {
	const ctx = await game(null);
	ctx.g.dev.fight(kind);
	ctx.g.dev.autoPlace();
	ctx.g.dev.startFight();
	ctx.g.step(3);
	assert.equal(ctx.g.dev.S, "fight");
	return ctx;
}

test("hurtProcs: вампиризм лечит, яд/заморозка вешают статусы, крит с цепью бьёт соседей; враг накладывает эффект стихии", async () => {
	const { g } = await inFight();
	g.dev.run("var __h = F.pl[0], __e = F.en[0]; __h.hp = Math.round(__h.max / 2); F.rb.ls = 0.5; F.rb.psn = 0; F.rb.frz = 0; F.rb.chain = 0");
	const hp0 = g.dev.run("__h.hp");
	g.dev.run("hurtProcs(__h, __e, 40, false, __e.y - 28, {})");
	assert.equal(g.dev.run("__h.hp"), Math.min(g.dev.run("__h.max"), hp0 + 20), "вампиризм 50 % от 40");
	g.dev.run("F.rb.ls = 0; F.rb.psn = 0.1; F.rb.frz = 1");
	g.dev.run("hurtProcs(__h, __e, 40, false, 0, {})");
	assert.ok(g.dev.run("!!__e.st.poison"), "яд");
	assert.ok(g.dev.run("!!(__e.st.stun && __e.st.stun.ice)"), "ледяное оглушение");
	// цепная молния: соседи рядом получают долю урона
	// соседи: два клона рядом и один далеко (в начале боя на поле может быть один враг)
	g.dev.run("F.rb.psn = 0; F.rb.frz = 0; F.rb.chain = 0.5; F.en.length = 1; for (let i = 1; i <= 3; i++) F.en.push(Object.assign({}, __e, { st: {}, hp: 500, max: 500, sh: 0, inv: 0, x: __e.x + (i === 3 ? 400 : i * 30), y: __e.y }))");
	const before = JSON.parse(g.dev.run("JSON.stringify(F.en.map((e) => e.hp))"));
	g.dev.run("hurtProcs(__h, __e, 40, true, 0, {})");
	const after = JSON.parse(g.dev.run("JSON.stringify(F.en.map((e) => e.hp))"));
	const hitOthers = before.filter((h, i) => i > 0 && after[i] < h).length;
	assert.equal(hitOthers, 2, "цепь задела ровно двух ближних соседей: " + hitOthers);
	assert.equal(after[3], before[3], "дальний (400 px) не задет");
	assert.equal(after[0], before[0], "цель цепь не бьёт повторно");
	// враг: эффект стихии с шансом stc
	g.dev.run('var __foe = { team: 1, el: "fire", atk: 10 }; hurtProcs(__foe, __h, 5, false, 0, { stc: 1 })');
	assert.ok(g.dev.run("!!__h.st.burn"), "ожог от огненного врага");
	g.dev.run('var __foe2 = { team: 1, el: "phys", atk: 10 }; delete __h.st.chill; hurtProcs(__foe2, __h, 5, false, 0, { stc: 1 })');
	assert.equal(g.dev.run("!!__h.st.chill"), false, "у физической стихии эффекта нет");
	assert.equal(g.dev.errs().length, 0);
});

test("wxBolt/wxBomb: ставят метки у случайных бойцов и перезаводят таймер; срабатывание метки бьёт тех, кто рядом", async () => {
	const { g } = await inFight();
	g.dev.run("var __all = liv(F.pl).concat(liv(F.en)); F.tele = []");
	g.dev.run("wxBolt(F.A, __all)");
	assert.equal(g.dev.run("F.tele.length"), 1);
	assert.equal(g.dev.run("F.tele[0].r"), 50);
	const ev = g.dev.run("F.A.ev");
	assert.ok(ev >= 4 && ev <= 6, "таймер грозы " + ev);
	// все бойцы в точку удара — все получают урон и шок
	g.dev.run("__all.forEach((u) => { u.x = F.tele[0].x; u.y = F.tele[0].y; u.inv = 0; u.sh = 0; })");
	const hp0 = JSON.parse(g.dev.run("JSON.stringify(__all.map((u) => u.hp))"));
	g.dev.run("F.tele[0].fn()");
	const hp1 = JSON.parse(g.dev.run("JSON.stringify(__all.map((u) => u.hp))"));
	for (let i = 0; i < hp0.length; i++) assert.ok(hp1[i] < hp0[i], "молния задела бойца " + i);
	assert.ok(g.dev.run("__all.every((u) => u.hp <= 0 || !!u.st.stun)"), "шок — оглушение");
	assert.ok(g.dev.run("F.A.fl") > 0, "вспышка");
	g.dev.run("F.tele = []; wxBomb(F.A, __all)");
	assert.equal(g.dev.run("F.tele.length"), 2);
	assert.ok(g.dev.run("F.tele.every((q) => q.drop === 1 && q.r === 56)"));
	const ev2 = g.dev.run("F.A.ev");
	assert.ok(ev2 >= 3.6 && ev2 <= 5, "таймер бомб " + ev2);
	g.dev.run("F.tele[0].fn()");
	assert.ok(g.dev.run("__all.some((u) => u.st.burn)"), "поджог");
	// без бойцов — меток нет, таймер всё равно перезаведён
	g.dev.run("F.tele = []; F.A.ev = 0; wxBolt(F.A, []); var __e1 = F.A.ev; F.A.ev = 0; wxBomb(F.A, [])");
	assert.equal(g.dev.run("F.tele.length"), 0);
	assert.ok(g.dev.run("__e1") > 0 && g.dev.run("F.A.ev") > 0);
	assert.equal(g.dev.errs().length, 0);
});

test("uOutline/uTints: обводка 4 силуэтами для выбранного и неуязвимого; подкраска по статусам и вспышка удара", async () => {
	const { g, rec } = await game();
	g.dev.run("var __u = G.slots[0]; var __set = uSet(__u, 0); var __img = __set[1]; var __f = uFrame(__u, __set[0]); __u.inv = 0; __u.hitT = 0; __u.st = {}");
	// первый вызов с новым цветом строит силуэт в кэше (лишний drawImage на оффскрине) — считаем второй
	const warm = (code) => (rec(code), rec(code));
	assert.equal(count(rec("uOutline(__u, {}, __img, __f, 300, 300, 1, AP, 1)"), "drawImage"), 0);
	assert.equal(count(warm("uOutline(__u, { sel: 1 }, __img, __f, 300, 300, 1, AP, 1)"), "drawImage"), 4);
	g.dev.run("__u.inv = 1");
	const inv = warm("uOutline(__u, {}, __img, __f, 300, 300, 1, AP, 1)");
	assert.equal(count(inv, "drawImage"), 4);
	assert.ok(inv.some((l) => /globalAlpha=0\./.test(l)) && /globalAlpha=1$/.test(inv[inv.length - 1]), "мигание и возврат прозрачности");
	g.dev.run("__u.inv = 0");
	assert.equal(count(rec("uTints(__u, {}, __img, __f, 300, 300, 1, AP, 1)"), "drawImage"), 0);
	g.dev.run("__u.st = { poison: { t: 1 }, burn: { t: 1 }, curse: { t: 1 } }");
	assert.equal(count(warm("uTints(__u, {}, __img, __f, 300, 300, 1, AP, 1)"), "drawImage"), 3);
	g.dev.run("__u.st = { stun: { t: 1, ice: 1 }, chill: { t: 1 } }");
	assert.equal(count(warm("uTints(__u, {}, __img, __f, 300, 300, 1, AP, 1)"), "drawImage"), 1, "лёд перекрывает холод");
	g.dev.run("__u.st = {}; __u.hitT = 0.1");
	const hit = warm("uTints(__u, { a: 0.5 }, __img, __f, 300, 300, 1, AP, 1)");
	assert.equal(count(hit, "drawImage"), 1);
	assert.ok(hit.some((l) => /globalAlpha=0\.4/.test(l)), "вспышка с учётом прозрачности o.a: 0.83·0.5");
	g.dev.run("__u.hitT = 0");
	// dUnit целиком рисует кадр бойца
	assert.ok(count(rec("dUnit(__u, 0, {})"), "drawImage") >= 1);
});

test("teleLine/teleBand/teleRing: формы меток; dTele рисует каждую метку своей формой", async () => {
	const { g, rec } = await inFight();
	const line = rec('teleLine({ x: 600, y: 300, a: 0.3, len: 120, c: "#f00" }, 0.5, 0.5)');
	assert.equal(count(line, "fillRect"), 4);
	assert.equal(count(line, "rotate"), 1);
	assert.equal(count(line, "save"), count(line, "restore"));
	const band = rec('teleBand({ y: 300, h: 40, c: "#f00" }, 0.5, 0.5)');
	assert.equal(count(band, "fillRect"), 4);
	assert.equal(count(band, "stroke"), 9, "девять стрелок");
	const ring = rec('teleRing({ x: 600, y: 300, r: 50, c: "#f00" }, 0.5, 0.5)');
	assert.equal(count(ring, "ellipse"), 3);
	assert.equal(count(ring, "fill"), 2);
	assert.equal(count(ring, "stroke"), 1);
	assert.equal(count(ring, "setLineDash"), 2, "пунктир включён и снят");
	g.dev.run('F.tele = [{ shape: "line", x: 600, y: 300, a: 0, len: 100, c: "#f00", t: 0.5, d: 1 }, { shape: "band", y: 300, h: 40, c: "#0f0", t: 0.5, d: 1 }, { x: 600, y: 300, r: 50, c: "#00f", t: 0.5, d: 1 }]');
	const all = rec("dTele(F.A)");
	assert.equal(count(all, "fillRect"), 8);
	assert.equal(count(all, "ellipse"), 3);
	assert.equal(count(all, "stroke"), 10, "лента 9 стрелок + круг 1");
	assert.equal(all.filter((l) => /globalAlpha=1$/.test(l)).length, 3, "после каждой метки прозрачность возвращается");
	g.dev.run("F.tele = []");
});

test("bakeRow: заполняет только свою строку цветами палитры; bakeGround — это строки подряд", async () => {
	const { g } = await game(null);
	g.dev.run("var __J = { id: { data: new Uint8ClampedArray(609 * 270 * 4) }, cols: [[10, 20, 30], [40, 50, 60], [70, 80, 90]], R2: rng32(5), seed: 42 }; bakeRow(__J, 10)");
	const rows = JSON.parse(g.dev.run("JSON.stringify([9, 10, 11].map((py) => { let a = 0, ok = 0; for (let px = 0; px < 609; px++) { const i = (py * 609 + px) * 4, d = __J.id.data; if (d[i + 3] === 255) a++; const c = [[10, 20, 30], [40, 50, 60], [70, 80, 90]].find((cc) => (cc[0] === d[i] && cc[1] === d[i + 1] && cc[2] === d[i + 2]) || (Math.round(cc[0] * 0.9) === d[i] && Math.round(cc[1] * 0.9) === d[i + 1] && Math.round(cc[2] * 0.9) === d[i + 2])); if (c) ok++; } return [a, ok]; }))"));
	assert.deepEqual(rows[0], [0, 0], "строка выше пуста");
	assert.deepEqual(rows[2], [0, 0], "строка ниже пуста");
	assert.deepEqual(rows[1], [609, 609], "вся строка непрозрачна и из цветов палитры (или их тени 0.9)");
	// три тона встречаются (пятна по шуму)
	const tones = JSON.parse(g.dev.run("JSON.stringify((() => { const s = new Set(); for (let px = 0; px < 609; px++) s.add(__J.id.data[(10 * 609 + px) * 4]); return [...s]; })())"));
	assert.ok(tones.length >= 2, "в строке несколько тонов: " + tones);
	// bakeGround(J, 0, 270) == bakeRow по всем строкам с тем же R2
	const sum = (code) => g.dev.run("(() => { " + code + " let h = 0; for (let i = 0; i < __J.id.data.length; i++) h = (h * 31 + __J.id.data[i]) >>> 0; return h; })()");
	const a = sum("__J = { id: { data: new Uint8ClampedArray(609 * 270 * 4) }, cols: __J.cols, R2: rng32(5), seed: 42 }; bakeGround(__J, 0, 270);");
	const b = sum("__J = { id: { data: new Uint8ClampedArray(609 * 270 * 4) }, cols: __J.cols, R2: rng32(5), seed: 42 }; for (let py = 0; py < 270; py++) bakeRow(__J, py);");
	assert.equal(a, b);
});

test("sfxH/sfxFight/sfxUi: генераторы корректны, банк звуков строится в прежнем порядке и выдаёт конечные отсчёты", async () => {
	const { g, json } = await game(null);
	assert.equal(g.dev.run("sfxH.sq(0.3)"), 1);
	assert.equal(g.dev.run("sfxH.sq(-2)"), -1);
	assert.equal(g.dev.run("sfxH.seq(0.25, [1, 2, 3], 0.1)"), 3);
	assert.equal(g.dev.run("sfxH.seq(0, [1, 2, 3], 0.1)"), 1);
	assert.ok(Math.abs(g.dev.run('(() => { const s = {}; let v = 0; for (let i = 0; i < 100; i++) v = sfxH.lp(s, "l", 1, 0.5); return v; })()') - 1) < 1e-6, "фильтр сходится к входу");
	assert.ok(Math.abs(g.dev.run('(() => { const s = {}; sfxH.o2(s, "b", 100); return s.b - (6.2832 * 100) / 22050; })()')) < 1e-12, "фаза накапливается");
	const build = (fn) => json(`(() => { const B = {}; ${fn}(B, (d, f) => ({ d, f }), (s, f) => Math.sin((s.p = (s.p || 0) + f / 22050)), () => 0.5); return Object.keys(B).map((k) => [k, B[k].d, [0, 0.01, 0.1, B[k].d * 0.9].map((t) => B[k].f(t, {})).every((v) => Number.isFinite(v))]); })()`);
	const fight = build("sfxFight"),
		ui = build("sfxUi");
	assert.deepEqual(
		fight.map((r) => r[0]),
		["crit", "crack", "roar", "spawn", "start", "abil", "ult", "holy", "ice", "fire", "poison", "bolt", "dark", "prism", "chaos", "slime", "spit", "dash", "bossdie"]
	);
	assert.deepEqual(
		ui.map((r) => r[0]),
		["pick", "place", "lvl", "chest", "step", "fanfare", "rev0", "rev1", "rev2", "rev3", "rev4", "rev5"]
	);
	for (const [k, d, fin] of fight.concat(ui)) {
		assert.ok(d > 0 && d <= 2, k + ": длительность " + d);
		assert.equal(fin, true, k + ": конечные отсчёты");
	}
	// раскрытие карты: чем выше редкость, тем длиннее
	const rev = ui.filter((r) => r[0].startsWith("rev")).map((r) => r[1]);
	for (let i = 1; i < rev.length; i++) assert.ok(rev[i] > rev[i - 1], "rev" + i + " длиннее rev" + (i - 1));
});

test("ambientTick/simTick: погода мира на карте и в следующем мире, снег в меню; сбой симуляции попадает в журнал, а не наружу", async () => {
	const { g } = await game();
	g.dev.run("Parts.clear(); MAPA.w = null");
	for (let i = 0; i < 60; i++) g.dev.run("ambientTick(1 / 60)");
	assert.equal(g.dev.run("MAPA.w === WORLDS[G.w]"), true);
	assert.ok(g.dev.run("Parts.a.length") > 0, "частицы погоды на карте");
	g.dev.S = "world";
	g.dev.run("ambientTick(1 / 60)");
	assert.equal(g.dev.run("MAPA.w === WORLDS[Math.min(WORLDS.length - 1, G.w + 1)]"), true, "на экране «мир пройден» — погода следующего мира");
	g.dev.S = "menu";
	g.dev.run("ambientTick(1 / 60)");
	assert.equal(g.dev.run("MAPA.w === WORLDS[0]"), true);
	g.dev.S = "fight";
	g.dev.run("MAPA.w = null; ambientTick(1 / 60)");
	assert.equal(g.dev.run("MAPA.w"), null, "в бою атмосфера карты не трогается");
	// симуляция: в бою таймер боя идёт; брошенная ошибка — в журнал
	const f = await inFight();
	const t0 = f.g.dev.run("F.timer");
	f.g.dev.run("Loop.reset(); simTick(1000 / 60, 1 / 60)");
	assert.ok(f.g.dev.run("F.timer") < t0, "шаг симуляции выполнен (таймер боя идёт вниз)");
	f.g.dev.makeUpdateThrow(1);
	f.g.dev.run("simTick(1000 / 60, 1 / 60)");
	const errs = f.g.dev.errs();
	assert.equal(errs.length, 1);
	assert.equal(errs[0].kind, "update");
	assert.equal(f.g.fatal, null);
});
