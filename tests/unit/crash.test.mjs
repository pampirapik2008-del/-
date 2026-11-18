// Аварийное окно при СЛОМАННОЙ игре (этап P): update бросает исключение каждый кадр, а не разово.
// Проверяется настоящий путь crashScreen → DOM (а не только crashWire на подделке): окно появляется
// один раз, игра продолжает рисовать кадры, «В меню» уводит в меню и закрывает окно, при продолжающихся
// сбоях окно открывается снова, «Откатить версию» просит загрузчик вернуть оригинал (#orig + reload),
// «Скопировать отчёт» не падает без буфера обмена. Заглушке DOM для этого нужен реестр элементов по id.
import test from "node:test";
import assert from "node:assert/strict";
import { createDom } from "../harness/dom.mjs";
import { boot } from "../harness/boot.mjs";

// заглушка DOM с реестром id: innerHTML с id="…" рождает дочерние элементы, querySelector('#id') и
// getElementById их находят, remove() снимает регистрацию (как в браузере — ровно настолько, насколько
// нужно crashScreen)
function domWithIds() {
	const dom = createDom();
	const doc = dom.document;
	const byId = new Map();
	const mk = doc.createElement;
	const patch = (el) => {
		let html = "",
			id = "";
		const kids = [];
		Object.defineProperty(el, "id", { get: () => id, set: (v) => { id = String(v); byId.set(id, el); } });
		Object.defineProperty(el, "innerHTML", {
			get: () => html,
			set: (v) => {
				html = String(v);
				for (const m of html.matchAll(/<(\w+)[^>]*?\sid="([^"]+)"/g)) {
					const k = patch(mk(m[1]));
					k.textContent = "";
					k.id = m[2];
					kids.push(m[2]);
				}
			},
		});
		el.remove = () => {
			byId.delete(id);
			for (const k of kids) byId.delete(k);
		};
		el.querySelector = (sel) => (sel[0] === "#" && byId.get(sel.slice(1))) || null;
		el.appendChild = () => {};
		return el;
	};
	doc.createElement = (tag) => (tag === "canvas" ? mk(tag) : patch(mk(tag)));
	doc.getElementById = (i) => (i === "c" ? mk("canvas") : byId.get(i) || null);
	patch(doc.body);
	let reloads = 0;
	dom.windowObj.location = { hash: "", href: "http://localhost/", reload: () => reloads++ };
	return { dom, byId, reloads: () => reloads };
}

test("аварийное окно при сломанной игре: появляется один раз, игра жива, «В меню» и повторное окно, откат и отчёт", async () => {
	const { dom, byId, reloads } = domWithIds();
	const g = boot({ dom });
	assert.ok(await g.ready());
	g.step(5);
	g.dev.seed(3);
	g.dev.newGame();
	for (let i = 0; i < 4; i++) g.dev.setSlot(i, g.dev.HEROES[i]);
	g.dev.fight("norm");
	g.dev.autoPlace();
	g.dev.startFight();
	g.step(3);
	assert.equal(g.dev.S, "fight");
	assert.equal(byId.get("mx-crash"), undefined, "до сбоев окна нет");

	g.dev.makeUpdateThrow(1e9); // игра сломана насовсем
	g.step(3);
	const wrap = byId.get("mx-crash");
	assert.ok(wrap, "после трёх сбоев подряд окно в DOM");
	assert.equal(g.dev.crash(), true);
	assert.equal(g.fatal, null, "цикл кадра не остановлен");
	const msg = byId.get("mx-crash-msg").textContent;
	assert.match(msg, /^update: тестовая ошибка update · кадр \d+ · экран fight$/, msg);

	// сбои продолжаются — окно одно, кадры идут
	const frames0 = g.frames;
	g.step(20);
	assert.equal(g.frames, frames0 + 20, "кадры продолжают идти");
	assert.equal(byId.get("mx-crash"), wrap, "окно не пересоздаётся каждый кадр");
	assert.ok(g.dev.errs().length >= 20, "сбои пишутся в журнал (с потолком ERR_MAX)");

	// «В меню»: окно закрыто, бой сброшен, экран — меню
	byId.get("mx-crash-menu").onclick();
	assert.equal(g.dev.S, "menu");
	assert.equal(g.dev.F, null);
	assert.equal(g.dev.crash(), false);
	assert.equal(byId.get("mx-crash"), undefined, "окно убрано из DOM");

	// игра всё ещё сломана: после трёх следующих кадров окно открывается снова (не «мёртвый» экран)
	g.step(4);
	const wrap2 = byId.get("mx-crash");
	assert.ok(wrap2 && wrap2 !== wrap, "новое окно после новых сбоев");
	assert.match(byId.get("mx-crash-msg").textContent, /экран menu$/);

	// «Скопировать отчёт» без буфера обмена — без исключения, кнопка меняет текст, отчёт содержит сбой
	byId.get("mx-crash-copy").onclick();
	assert.equal(byId.get("mx-crash-copy").textContent, "Скопировано");
	const report = JSON.parse(g.dev.run("errReport()"));
	assert.ok(report.errors.some((e) => e.kind === "update" && e.msg === "тестовая ошибка update"), "в отчёте есть сбой update");
	assert.ok(report.screens.includes("fight>menu@" + report.screens.find((x) => x.startsWith("fight>menu@")).split("@")[1]), "в отчёте — переходы экранов");
	assert.equal(report.version, "orig");

	// «Откатить версию»: загрузчику — вернуть оригинал
	byId.get("mx-crash-roll").onclick();
	assert.equal(dom.windowObj.location.hash, "#orig");
	assert.equal(reloads(), 1);
	assert.equal(g.fatal, null);
});

test("аварийное окно: сломана отрисовка — окно тоже появляется, «Продолжить» лишь закрывает его, при живом кадре серия сбрасывается", async () => {
	const { dom, byId } = domWithIds();
	const g = boot({ dom });
	assert.ok(await g.ready());
	g.step(5);
	g.dev.makeDrawThrow(5); // пять сбоев подряд, потом кадры нормальные
	g.step(3);
	assert.ok(byId.get("mx-crash"), "окно после трёх сбоев draw");
	byId.get("mx-crash-go").onclick();
	assert.equal(byId.get("mx-crash"), undefined);
	assert.equal(g.dev.crash(), false);
	g.step(2); // 4-й и 5-й сбои — серия после закрытия начинается заново (0 → 2), окна нет
	assert.equal(byId.get("mx-crash"), undefined, "двух сбоев после закрытия недостаточно");
	g.step(5); // кадры живые — серия сброшена
	assert.equal(g.dev.run("ERR_STREAK"), 0);
	assert.equal(g.fatal, null);
});
