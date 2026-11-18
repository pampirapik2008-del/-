#!/usr/bin/env node
// Скриншоты экранов игры без браузера: та же обвязка, что у тестов, но холст и Image —
// настоящие (@napi-rs/canvas), поэтому PNG показывают реальную отрисовку, шрифт и арты.
//   npm i -D @napi-rs/canvas          # один раз
//   node tools/shots.mjs [--out .artifacts/shots] [--seed 7] [--html path/to/game.html]
// --html рендерит готовый монолит (например, залитую пользователем версию) вместо src/.
import fs from "node:fs";
import path from "node:path";
import { createDom } from "../tests/harness/dom.mjs";
import { boot, ROOT } from "../tests/harness/boot.mjs";
import { codeFromHtml } from "./lib/assemble.mjs";

const args = process.argv.slice(2);
const opt = (f, d) => {
	const i = args.indexOf(f);
	return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const OUT = path.resolve(opt("--out", ".artifacts/shots"));
const SEED = Number(opt("--seed", 7));
const HTML = opt("--html", null);

let napi;
try {
	napi = await import("@napi-rs/canvas");
} catch (e) {
	console.error("нужен пакет @napi-rs/canvas: npm i -D @napi-rs/canvas");
	process.exit(2);
}
const { createCanvas, Image, GlobalFonts } = napi;
GlobalFonts.register(fs.readFileSync(path.join(ROOT, "assets/font.woff2")), "GameFont");

fs.mkdirSync(OUT, { recursive: true });
const dom = createDom({ dpr: 1, canvasFactory: (w, h) => createCanvas(w, h), ImageClass: Image });
const g = boot({ dom, code: HTML ? codeFromHtml(HTML) : null });
const dev = g.dev;
let shotN = 0;
const taken = [];
function shot(name) {
	const file = path.join(OUT, String(++shotN).padStart(2, "0") + "_" + name + ".png");
	fs.writeFileSync(file, dom.mainCanvas.toBuffer("image/png"));
	taken.push({ file: path.basename(file), S: dev.S, errors: g.errors.length });
	return file;
}
const seed = (v) => {
	try {
		dev.seed(v);
	} catch (_) {
		/* старые сборки без Rand: рендерим как есть */
	}
};
const click = (label) => {
	const h = dev.findHit(label);
	if (!h) throw new Error("нет кнопки «" + label + "» на экране " + dev.S + " (есть: " + (dev.hits || []).map((q) => q.label || "?").join(", ") + ")");
	g.clickHit(h);
};
// дождаться конца боя, не дольше max кадров
const runFight = (max = 6000) => {
	for (let i = 0; i < max; i++) {
		g.step(1);
		if (dev.S !== "fight" || (dev.F && dev.F.out)) return;
	}
};
// дождаться ухода с экрана боя (итоговая плашка висит пару секунд)
const leaveFight = (max = 900) => {
	for (let i = 0; i < max && dev.S === "fight"; i++) g.step(1);
};
// закрыть все всплывшие события подряд
const closeEvents = () => {
	for (let i = 0; i < 12 && dev.S === "msg"; i++) {
		g.key(" ");
		g.step(25);
	}
};

g.step(2);
shot("loading");
if (!(await g.ready(8000))) {
	console.error("игра не загрузилась", g.errors.slice(0, 5));
	process.exit(1);
}
dev.labelButtons();
seed(SEED);
dev.newGame();
g.step(40);
shot("menu");

// --- новая игра: выбор бойца ---
click("Новая игра");
g.step(40);
shot("pick");
g.click(609 - 262, 88 + 165); // левая карточка
g.step(20);
shot("pick_selected");
click("В поход!");
g.step(40);
shot("map");

// карточка бойца на карте
g.click(343 + 30, 470 + 30);
g.step(12);
shot("map_hero_card");
g.click(20, 20);
g.step(4);

// --- события по типам узлов (go() не проверяет соседство — удобно для обхода) ---
const nodeOf = (k) => dev.N.findIndex((n, i) => i > 0 && n.k === k && !dev.G.vis.has(i));
const event = (k, name) => {
	const i = nodeOf(k);
	if (i < 0) return console.log("на карте нет узла", k);
	dev.go(i);
	g.step(70);
	shot(name);
	if (dev.S === "msg") {
		g.key(" "); // открыть сундук / закрыть
		g.step(70);
		if (dev.S === "msg") shot(name + "_open");
		closeEvents();
	}
	g.step(10);
};
event("chest", "event_chest");
event("tribe", "event_tribe");
event("barr", "event_barracks");

// --- обычный бой: расстановка, ход боя, итог ---
dev.fight("norm");
g.step(30);
shot("prep");
g.key(" "); // авторасстановка
g.step(20);
shot("prep_placed");
g.key(" "); // в бой
g.step(90);
shot("fight");
g.step(240);
shot("fight_late");
g.key("Escape");
g.step(10);
shot("pause");
g.key("Escape");
runFight();
g.step(100);
shot(dev.S === "lose" ? "lose_after_fight" : "fight_result");
leaveFight();
g.step(40);
if (dev.S === "msg") shot("fight_reward");
closeEvents();
g.step(10);

// --- лавка (открыта после победы) ---
if (dev.S === "map") {
	dev.G.coin += 60;
	dev.openShop();
	g.step(30);
	shot("shop");
	const hs = (dev.hits || []).filter((h) => !h.label && h.y < 400 && h.w > 100);
	if (hs.length) {
		g.clickHit(hs[0]);
		g.step(10);
		shot("shop_relic_selected");
	}
	click("В путь");
	g.step(10);
	// подсказка при закрытой лавке
	dev.G.shop = false;
	dev.openShop();
	g.step(20);
	shot("map_toast");
}

// карточка бойца с длинными описаниями: панель должна растянуться, не наезжая на кнопку
dev.setSlot(2, dev.HEROES.find((h) => h.k === "necro") || dev.HEROES[6]);
dev.S = "map";
g.step(5);
g.click(343 + 2 * 67.5 + 30, 470 + 30);
g.step(12);
shot("map_hero_card_long");
g.click(20, 20);
g.step(4);

// --- босс ---
dev.fight("boss");
g.step(10);
g.key(" ");
g.step(10);
g.key(" ");
g.step(150);
shot("boss_fight");
runFight();
g.step(90);
shot(dev.S === "lose" ? "lose" : "boss_result");
leaveFight();
g.step(40);
if (dev.S === "msg") {
	shot("boss_reward");
	g.key(" ");
	g.step(40);
	if (dev.S === "msg") {
		shot("boss_relic_pick");
		g.key(" "); // открыть сундук
		g.step(80);
		if (dev.S === "msg") shot("boss_relic_pick_open");
	}
}
closeEvents();

// --- другой мир: болото, бой на глубине ---
dev.setWorld(4, 6);
seed(SEED + 2);
dev.fight("swamp");
g.step(10);
g.key(" ");
g.step(120);
shot("fight_swamp");
runFight();
leaveFight();
closeEvents();

// --- мир пройден / финал / поражение (экраны можно открыть напрямую) ---
dev.S = "world";
g.step(70);
shot("world_done");
dev.S = "win";
g.step(70);
shot("win");
dev.S = "lose";
g.step(70);
shot("lose");

// --- коллекция, настройки ---
dev.S = "menu";
g.step(10);
click("Коллекция");
g.step(20);
shot("codex");
g.click(12 + 82, 74 + 100); // первая карточка
g.step(10);
shot("codex_card");
click("Просмотр анимаций");
g.step(30);
shot("codex_anim");
dev.S = "menu";
g.step(10);
click("Настройки");
g.step(20);
shot("settings");

// --- арена ---
dev.S = "menu";
g.step(10);
seed(SEED + 1);
click("Боевая арена");
g.step(30);
shot("arena_prep");

const bad = g.errors.length || g.fatal;
console.log(`скриншоты: ${taken.length} в ${OUT}${HTML ? " (из " + HTML + ")" : ""}`);
for (const s of taken) console.log("  " + s.file.padEnd(28) + " S=" + s.S);
console.log(`ошибок консоли: ${g.errors.length}${g.fatal ? ", fatal: " + String(g.fatal).slice(0, 200) : ""}`);
if (g.errors.length) console.log("  первые:", g.errors.slice(0, 5));
process.exit(bad ? 1 : 0);
