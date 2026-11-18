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

test("bakeForest: деревья и мелочи — детерминированно по R, снизу вверх, не на дорогах и не в озёрах", async () => {
	const { g, rec, json } = await game();
	g.dev.run(bakeJ + "; MAPL = [[200, 100, 80, 40]]");
	const a = rec("bakeForest(__J.x, __J.im, __J.AM, rng32(5), __J.P, 42, () => 1e9, () => 1e9)");
	const b = rec("bakeForest(__J.x, __J.im, __J.AM, rng32(5), __J.P, 42, () => 1e9, () => 1e9)");
	assert.deepEqual(a, b, "одинаковый R — одинаковый лес");
	const n = count(a, "drawImage");
	assert.ok(n > 20, "лес не пустой: " + n);
	assert.equal(count(a, "ellipse"), n, "у каждого предмета своя тень");
	// центры теней идут по возрастанию y (рисуем снизу вверх по глубине)
	const ys = a.filter((l) => /\.ellipse\(/.test(l)).map((l) => +l.split("(")[1].split(",")[1]);
	for (let i = 1; i < ys.length; i++) assert.ok(ys[i] >= ys[i - 1], "порядок по y");
	// ничего внутри озера
	const AM = json("__J.AM");
	void AM;
	for (const l of a.filter((l) => /\.drawImage\(/.test(l))) {
		const p = l.split("(")[1].split(",");
		const dx = +p[5] + +p[3] / 2,
			dy = +p[6] + +p[4];
		assert.ok(!(dx > 194 && dx < 286 && dy > 98 && dy < 152), "предмет в озере: " + l);
	}
	// всё — дорога: леса нет
	assert.equal(count(rec("bakeForest(__J.x, __J.im, __J.AM, rng32(5), __J.P, 42, () => 0, () => 1e9)"), "drawImage"), 0);
	g.dev.bakeMap(1);
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
