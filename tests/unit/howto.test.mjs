// docs/HOWTO.md в действии: тестовые герой, реликвия и мир регистрируются ровно так, как описано
// в инструкции, и проходят через отряд, бой, сейв/загрузку, лавку и экраны без единой ошибки.
// Те же сценарии для своего контента: HOWTO_HERO=<k> HOWTO_RELIC=<id> HOWTO_WORLD=<id> node --test tests/unit/howto.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { boot } from "../harness/boot.mjs";

const j = (g, code) => JSON.parse(g.dev.run("JSON.stringify(" + code + ")"));

async function started(seed = 777) {
	const g = boot();
	assert.ok(await g.ready());
	g.step(5);
	g.dev.seed(seed);
	return g;
}
function noErrors(g, where) {
	const e = g.dev.errs();
	assert.equal(e.length, 0, where + ": " + e.map((x) => x.kind + " " + x.msg + " @" + x.screen + "#" + x.frame).join("; "));
}
// бой до конца (или лимита кадров); возвращает последнее состояние F
function runFight(g, kind, maxFrames) {
	g.dev.fight(kind);
	g.dev.autoPlace();
	g.dev.startFight();
	assert.equal(g.dev.S, "fight", "бой начался");
	let fr = 0,
		last = null;
	while (fr < maxFrames && g.dev.run('Machine.is("fight")')) {
		g.step(5);
		fr += 5;
		last = j(g, "F && { en: F.en.map((e) => [e.n, Math.round(e.hp), e.bph, e.pi]), pl: F.pl.map((u) => [u.k, Math.round(u.hp)]), out: F.out, st: F.st, w: F.w, wid: F.A.w.id }") || last;
	}
	return { frames: fr, last };
}

// ---------- §1 герой ----------
const ROWS = ["....ss....", "...sWWs...", "...sWWs...", "..bbbbbb..", "..bbbbbb..", "...dddd...", "...d..d..."];
function regTestHero(g) {
	return g.dev.run(`regHero({ k: "t_test", n: "Тестовый страж", rows: ${JSON.stringify(ROWS)}, pal: { s: "#b0b7c0", W: "#fff", b: "#3b8fd0", d: "#5a2d0c" },
		hp: 2600, atk: 72, aspd: 0.9, arm: 14, rng: 150, spd: 6, sc: 1, rar: 3, role: "Маг", crit: 0.08, el: "bolt",
		ab: { n: "Разряд", cd: 6, d: "Молния по ближайшему врагу." }, ult: { n: "Гроза", d: "Удар по области." }, desc: "Тестовый герой из docs/HOWTO.md",
		castAb(u) { const tg = nearest(u, liv(F.en)); if (!tg || dist(u, tg) > 360) return false; anim(u, "cast", 0.5); cutIn(u, KIT.t_test.ab.n); shoot(u, tg, eAtk(u) * 1.5, { el: "bolt", abil: 1, sp: 520 }); return true; } })`);
}
// герой с ключом k: отряд из трёх первых героев и его, сейв/загрузка, обычный бой до конца
function heroSmoke(g, k, { needAbility = false } = {}) {
	const h = j(g, `(({ n, k, hp, atk }) => ({ n, k, hp, atk }))(HEROES.find((x) => x.k === ${JSON.stringify(k)}) || {})`);
	assert.ok(h.n, "героя " + k + " нет в HEROES");
	assert.ok(j(g, `!!KIT[${JSON.stringify(k)}] && !!CAST[${JSON.stringify(k)}]`), "у героя нет KIT/CAST");
	assert.ok(j(g, `!!(ATL.heroes3[${JSON.stringify(k)}] || (IMG["gen_" + ${JSON.stringify(k)}] && ATL.heroes2[${JSON.stringify(k)}]) || ATL.heroes[${JSON.stringify(k)}])`), "у героя нет кадров спрайта");
	assert.ok(j(g, `!!EL[KIT[${JSON.stringify(k)}].el]`), "стихия героя не из EL");
	g.dev.newGame();
	for (let i = 0; i < 3; i++) g.dev.setSlot(i, g.dev.HEROES[i]);
	g.dev.run(`G.slots[3] = recruit(HEROES.find((x) => x.k === ${JSON.stringify(k)}), 0)`);
	g.dev.S = "map";
	g.step(2);
	// сохранение хранит имя, загрузка находит героя по нему
	g.dev.saveGame();
	assert.ok((g.readStorage("monsterAwakeningSave") || "").includes(h.n), "в сейве есть имя героя");
	g.dev.loadGame();
	assert.equal(j(g, "G.slots[3] && G.slots[3].k"), k, "после загрузки герой на месте");
	// считаем его удары и срабатывания способности
	g.dev.run(`var __hits = { n: 0, dm: 0, ab: 0 }, __k = ${JSON.stringify(k)};
		Events.on("unit:hit", (tg, e, src) => { if (src && src.k === __k) { __hits.n++; __hits.dm += e.dm; } });
		var __ab0 = CAST[__k].ab; CAST[__k].ab = function (u) { const r = __ab0.call(this, u); if (r) __hits.ab++; return r; };`);
	g.dev.setWorld(0, 4);
	const { frames, last } = runFight(g, "norm", 1800);
	assert.ok(frames < 1800, "бой закончился за " + frames + " кадров");
	assert.ok(last.pl.some((p) => p[0] === k), "герой был на поле");
	const hits = j(g, "__hits");
	assert.ok(hits.n > 0 && hits.dm > 0, "герой наносил урон: " + JSON.stringify(hits));
	if (needAbility) assert.ok(hits.ab >= 1, "способность сработала хотя бы раз: " + JSON.stringify(hits));
	noErrors(g, "бой с героем " + k);
	// кодекс рисует всех героев
	g.dev.S = "codex";
	g.step(10);
	noErrors(g, "кодекс");
	return { hits, last };
}

test("§1 герой: regHero создаёт строку HEROES, KIT, CAST, атлас и спрайт; бой, сейв и кодекс без ошибок", async () => {
	const g = await started();
	const n0 = j(g, "HEROES.length");
	assert.equal(regTestHero(g), "t_test", "regHero возвращает ключ");
	assert.equal(j(g, "HEROES.length"), n0 + 1);
	assert.deepEqual(j(g, "Object.keys(ATL.heroes2.t_test)"), ["idle", "walk", "atk", "hurt", "dead", "cast", "ult", "win", "port"]);
	assert.deepEqual(j(g, "[IMG.gen_t_test.width, IMG.gen_t_test.height]"), [ROWS[0].length * 4, ROWS.length * 5], "атлас 4×5 кадров");
	assert.deepEqual(j(g, "[KIT.t_test.role, KIT.t_test.el, KIT.t_test.ab.n, KIT.t_test.ab.cd]"), ["Маг", "bolt", "Разряд", 6]);
	const { hits } = heroSmoke(g, "t_test", { needAbility: true });
	assert.ok(hits.n >= 3, "ударов: " + hits.n);
});

test("§1 герой: regHero не даёт дважды занять ключ или имя и не принимает стихию вне EL", async () => {
	const g = await started();
	regTestHero(g);
	const err = (code) => {
		try {
			g.dev.run(code);
		} catch (e) {
			return String(e.message || e);
		}
		return "";
	};
	assert.match(err('regHero({ k: "t_test", n: "Другой", rows: ["a"] })'), /ключ t_test уже есть/);
	assert.match(err('regHero({ k: "t_other", n: "Тестовый страж", rows: ["a"] })'), /имя «Тестовый страж» уже есть/);
	assert.match(err('regHero({ k: "t_other", n: "Другой", rows: ["a"], el: "frost" })'), /неизвестная стихия frost \(есть: phys, nature/);
	assert.match(err("regHero({ k: \"t_other\", n: \"Другой\" })"), /нужны k, n, rows/);
	assert.equal(j(g, 'HEROES.filter((h) => h.k === "t_other").length'), 0, "неудачные вызовы ничего не оставили");
});

test("HOWTO_HERO: свой герой проходит тот же сценарий", { skip: !process.env.HOWTO_HERO && "задайте HOWTO_HERO=<ключ>" }, async () => {
	const g = await started();
	heroSmoke(g, process.env.HOWTO_HERO);
});

// ---------- §2 реликвия ----------
function regTestRelics(g) {
	g.dev.run(`RELIC.t_rune = { n: "Руна стойкости", st: (u, m) => (u.arm += Math.round(10 * m)), d: (m) => "Броня отряда +" + Math.round(10 * m), cmp: "arm" };
		RELIC.t_luck = { n: "Монета удачи", p: "crit", v: (m) => 0.1 * m, d: (m) => "Шанс крита +" + pct(0.1 * m) };
		RELIC_IDS.push("t_rune", "t_luck");
		ATL.ui.r_t_rune = ATL.ui.r_fang; ATL.ui.r_t_luck = ATL.ui.r_clover;`);
}
// реликвия id: выдаётся отряду, меняет характеристики или relBonus, переживает сейв, рисуется на карте, в лавке и на карточке награды
function relicSmoke(g, id) {
	const d = j(g, `RELIC[${JSON.stringify(id)}] ? { st: !!RELIC[${JSON.stringify(id)}].st, p: RELIC[${JSON.stringify(id)}].p || null, n: RELIC[${JSON.stringify(id)}].n, d: RELIC[${JSON.stringify(id)}].d(RAR[2].m) } : null`);
	assert.ok(d, "реликвии " + id + " нет в RELIC");
	assert.ok(d.st || d.p, "у реликвии нет ни st, ни p");
	assert.ok(j(g, `RELIC_IDS.includes(${JSON.stringify(id)})`), "реликвии нет в RELIC_IDS");
	assert.ok(j(g, `!!ATL.ui["r_" + ${JSON.stringify(id)}]`), "нет иконки r_" + id + " в атласе ui");
	assert.ok(d.n && typeof d.d === "string" && d.d.length > 0, "имя и описание");
	g.dev.newGame();
	for (let i = 0; i < 4; i++) g.dev.setSlot(i, g.dev.HEROES[i]);
	g.dev.S = "map";
	g.step(2);
	const stats = (u) => `(({ atk, arm, max, hp, spd, aspd }) => ({ atk, arm, max, hp, spd, aspd }))(${u})`;
	const before = j(g, `{ u: ${stats("mkHero(HEROES[0], 0)")}, b: relBonus() }`);
	g.dev.run(`grantRelic({ id: ${JSON.stringify(id)}, r: 2 })`);
	const after = j(g, `{ u: ${stats("recruit(HEROES[0], 0)")}, b: relBonus() }`);
	if (d.st) assert.notDeepEqual(after.u, before.u, "st изменила характеристики нового бойца");
	if (d.p) {
		assert.ok(before.b[d.p] !== undefined, "ключ p=" + d.p + " должен быть в литерале b внутри relBonus()");
		assert.ok(after.b[d.p] > before.b[d.p], "relBonus()." + d.p + " вырос");
	}
	// сейв хранит {id, r}, загрузка не отбрасывает известную реликвию
	g.dev.saveGame();
	g.dev.loadGame();
	assert.ok(j(g, "G.rel").some((q) => q.id === id && q.r === 2), "реликвия пережила сейв/загрузку");
	// экран карты с полкой реликвий
	g.dev.S = "map";
	g.step(10);
	noErrors(g, "карта с реликвией " + id);
	// лавка с этой реликвией в товаре: карточка, подсказка, покупка
	g.dev.run(`G.shop = true; G.coin = 999; G.stock = null; shopStock().rel[0] = { id: ${JSON.stringify(id)}, r: 1, sold: 0 };`);
	g.dev.openShop();
	assert.equal(g.dev.S, "shop");
	g.step(10);
	assert.equal(j(g, 'shopInfo(["relic", 0]).n'), d.n);
	assert.ok(j(g, "buyRelic(0)"), "покупка прошла");
	assert.equal(j(g, "G.rel.filter((q) => q.id === " + JSON.stringify(id) + ").length"), 2);
	g.step(5);
	noErrors(g, "лавка с реликвией " + id);
	// карточка награды «выбери реликвию» и выбор
	g.dev.S = "map";
	g.step(2);
	g.dev.run(`ev({ title: "Тайник", sub: "Выбери одну реликвию", pick: 1, chest: 2, cards: [{ t: "relic", id: ${JSON.stringify(id)}, r: 3 }, { t: "res", ic: "coin", n: 5 }] })`);
	g.step(80);
	g.dev.run("EV.sel = 0");
	g.dev.evClose();
	assert.ok(j(g, "G.rel").some((q) => q.id === id && q.r === 3), "реликвия из награды в отряде");
	g.step(5);
	noErrors(g, "награда с реликвией " + id);
}

test("§2 реликвия: форма st и форма p — найм, сейв, карта, лавка, награда без ошибок", async () => {
	const g = await started();
	regTestRelics(g);
	relicSmoke(g, "t_rune");
	assert.equal(j(g, "recruit(HEROES[0], 0).arm - mkHero(HEROES[0], 0).arm"), Math.round(10 * 2.2) + Math.round(10 * 1.5) + Math.round(10 * 3.2), "броня: три копии руны редкостей 2, 1 и 3");
	const g2 = await started(5);
	regTestRelics(g2);
	relicSmoke(g2, "t_luck");
	assert.ok(Math.abs(j(g2, "relBonus().crit") - (0.1 * 2.2 + 0.1 * 1.5 + 0.1 * 3.2)) < 1e-9, "крит: сумма по трём копиям");
	assert.equal(j(g2, "relPrice(2, 0)"), 18, "цена по редкости, не по реликвии");
});

test("HOWTO_RELIC: своя реликвия проходит тот же сценарий", { skip: !process.env.HOWTO_RELIC && "задайте HOWTO_RELIC=<id>" }, async () => {
	const g = await started();
	relicSmoke(g, process.env.HOWTO_RELIC);
});

// ---------- §3 мир ----------
function regTestWorld(g) {
	g.dev.run(`var __w = Object.assign({}, WORLDS[0], {
			id: "t_void", n: "Пустота", sub: "Тестовый мир", fy0: 232, amb: ["#d8cce8", "#9a86c0", "#5e4a8a"], wx: ["clear", "fog", "eclipse"],
			big: ["pillar", "wall", "boulder"], small: ["rocks", "stump"], destr: ["stump", "log", "shrooms"], light: ["lantern"], decor: ["pebble", "fern"], patch: ["ashp", "dirt"],
			el: "dark", foes: ["Тень малая", "Тень болотная", "Тень багровая"], tA: { to: 270, sat: 0.5, val: 0.9 }, tB: { to: 300, sat: 0.8, val: 0.9 },
			boss: { n: "Владыка пустоты", n2: "Пробуждённый владыка", p1: ["slam", "summon"], p2: ["slam", "volley", "drain"] }, ui: "#b89cff" });
		delete __w.tM;
		// в исходниках это делает WORLDS.forEach в 20_data.js
		__w.i = WORLDS.length; __w.stage = "stage_" + __w.id; WORLDS.push(__w);
		IMG[__w.stage] = IMG.stage_taiga; // заглушка вместо assets/img/stage_t_void.png
		MAPT.t_void = { g: ["#2a2438", "#231d30", "#342c44"], road: ["#6a5c80", "#2a2236"], dens: 0.3, tr: 0.5 };
		AMBI.t_void = ["wisp"];
		Tune.T.push([6, 20000]);`);
}
// мир id: таблицы на месте, карта, экран «Мир пройден» из предыдущего мира, бой с боссом
function worldSmoke(g, id) {
	const wi = j(g, `WORLDS.findIndex((w) => w.id === ${JSON.stringify(id)})`);
	assert.ok(wi >= 0, "мира " + id + " нет в WORLDS");
	const w = j(g, `WORLDS[${wi}]`);
	assert.equal(w.i, wi);
	assert.equal(w.stage, "stage_" + id);
	assert.ok(j(g, `!!IMG[${JSON.stringify(w.stage)}]`), "нет картинки " + w.stage + " (assets/img + asset-manifest.json)");
	assert.ok(j(g, "worldCount()") > wi, "worldCount() считает мир готовым");
	assert.ok(j(g, `!!MAPT[${JSON.stringify(id)}]`), "нет палитры карты MAPT." + id);
	assert.ok(j(g, "Tune.T.length") > wi, "нет записи Tune.T для мира №" + wi);
	assert.ok(j(g, `!!EL[${JSON.stringify(w.el)}]`), "стихия мира не из EL");
	for (const x of w.wx) assert.ok(j(g, `!!WX[${JSON.stringify(x)}]`), "погода не из WX: " + x);
	for (const p of (w.boss.p1 || []).concat(w.boss.p2 || [], w.boss.p3 || [])) assert.ok(j(g, `typeof BOSSP[${JSON.stringify(p)}] === "function"`), "приём босса не из BOSSP: " + p);
	assert.equal(w.foes.length, 3, "три имени врагов (a / m / b)");
	assert.deepEqual(j(g, `[foeDef(${wi}, "a").n, foeDef(${wi}, "m").n, foeDef(${wi}, "b").n, foeDef(${wi}, "boss").n]`), [w.foes[0], w.foes[1], w.foes[2], w.boss.n]);
	if (wi > 0) assert.ok(j(g, `foeDef(${wi}, "a").hp > foeDef(${wi - 1}, "a").hp`), "враги сильнее, чем в предыдущем мире");
	for (const p of w.patch || []) assert.ok(j(g, `!!PATCH[${JSON.stringify(p)}]`), "пятно земли не из PATCH: " + p);
	for (const s of [].concat(w.big || [], w.small || [], w.destr || [], w.light || [], w.decor || [])) assert.ok(j(g, `!!ATL.props[${JSON.stringify(s)}]`), "нет спрайта props: " + s);
	for (const a of j(g, `AMBI[${JSON.stringify(id)}] || []`)) assert.ok(j(g, `!!EMIT[${JSON.stringify(a)}]`), "эмиттер не из EMIT: " + a);
	// карта мира
	g.dev.newGame();
	for (let i = 0; i < 4; i++) g.dev.setSlot(i, g.dev.HEROES[i]);
	g.dev.setWorld(wi, 4);
	g.dev.genMap();
	g.dev.bakeNow();
	g.dev.S = "map";
	g.step(30);
	noErrors(g, "карта мира " + id);
	// экран «Мир пройден» предыдущего мира показывает окно в этот
	if (wi > 0) {
		g.dev.run(`G.w = ${wi - 1}; WT0 = t;`);
		g.dev.S = "world";
		g.step(10);
		assert.equal(j(g, "MAPA.w && MAPA.w.id"), id, "окно в следующий мир");
		noErrors(g, "экран «Мир пройден» перед миром " + id);
		g.dev.run(`G.w = ${wi}`);
		g.dev.S = "map";
		g.step(2);
	}
	// бой с боссом: 7 секунд — босс успевает применить приём первой фазы
	const { last } = runFight(g, "boss", 420);
	assert.equal(last.wid, id);
	assert.equal(last.en[0][0], w.boss.n, "босс мира на поле");
	assert.ok(last.en[0][3] >= 1, "босс применил хотя бы один приём: " + JSON.stringify(last.en[0]));
	assert.ok(j(g, "Tune.k").startsWith(wi + "|"), "музыка переключилась на мир: " + j(g, "Tune.k"));
	noErrors(g, "бой с боссом мира " + id);
	return last;
}

test("§3 мир: запись WORLDS + MAPT + AMBI + Tune.T + фон — карта, «Мир пройден», босс без ошибок", async () => {
	const g = await started();
	const n0 = j(g, "worldCount()");
	regTestWorld(g);
	assert.equal(j(g, "worldCount()"), n0 + 1, "мир стал виден игре");
	const last = worldSmoke(g, "t_void");
	assert.ok(last.en.length >= 2, "босс и свита");
	assert.ok(last.st.dmg > 0, "отряд наносил урон боссу");
});

test("§3 мир без картинки невидим: worldCount() останавливается на нём", async () => {
	const g = await started();
	regTestWorld(g);
	const n = j(g, "worldCount()");
	g.dev.run("delete IMG.stage_t_void");
	assert.equal(j(g, "worldCount()"), n - 1);
});

test("HOWTO_WORLD: свой мир проходит тот же сценарий", { skip: !process.env.HOWTO_WORLD && "задайте HOWTO_WORLD=<id>" }, async () => {
	const g = await started();
	worldSmoke(g, process.env.HOWTO_WORLD);
});
