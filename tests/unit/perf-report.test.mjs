// Отчёт: статистика, реальный цикл, DOM-окно и отмена свёрнутой вкладки.
import test from "node:test";
import assert from "node:assert/strict";
import { boot } from "../harness/boot.mjs";
import { createDom } from "../harness/dom.mjs";

function reportDom(dom) {
	const doc = dom.document, elements = new Map();
	const original = doc.createElement;
	doc.createElement = (tag) => {
		if (tag !== "div") return original(tag);
		const el = original(tag);
		el.appendChild = (child) => { el.children.push(child); };
		el.remove = () => elements.delete(el.id);
		el.querySelector = (sel) => el.fields?.get(sel.slice(1)) || null;
		Object.defineProperty(el, "innerHTML", { set(html) {
			el.fields = new Map([...html.matchAll(/id="([^"]+)"/g)].map((m) => [m[1], { style: {}, focus() {}, select() {} }]));
		} });
		return el;
	};
	const get = doc.getElementById;
	doc.getElementById = (id) => elements.get(id) || (id === "mx-perf" ? null : get(id));
	doc.body.appendChild = (el) => { if (el.id) elements.set(el.id, el); };
	return elements;
}

test("статистика: медиана, p95, худшие 5% FPS, строгие пороги и пустой набор", async () => {
	const g = boot();
	assert.ok(await g.ready());
	const s = JSON.parse(g.dev.run('JSON.stringify(perfReportStats([10, 16.7, 20, 33, 40], [1, 2, 3, 4], [0, 5, 10]))'));
	assert.equal(s.fps, 50);
	assert.equal(s.worstFps, 25);
	assert.equal(s.update, 2.5);
	assert.equal(s.update95, 4);
	assert.equal(s.draw, 5);
	assert.equal(s.draw95, 10);
	assert.equal(s.slow16, 60);
	assert.equal(s.slow33, 20);
	assert.deepEqual(JSON.parse(g.dev.run('JSON.stringify(perfReportStats([], [], []))')), { fps: 0, worstFps: 0, update: 0, update95: 0, draw: 0, draw95: 0, slow16: 0, slow33: 0 });
});

test("замер через loop: 120 секунд, условия, окно, копирование и закрытие", async () => {
	const dom = createDom(), g = boot({ dom });
	assert.ok(await g.ready());
	const elements = reportDom(dom);
	dom.windowObj.performance.now = () => 0;
	g.dev.run('perfReportStart()');
	g.step(600);
	assert.equal(elements.has('mx-perf'), false);
	g.dev.run('setQ(0); Machine.go("settings")');
	g.step(6590);
	assert.equal(elements.has("mx-perf"), false, "раньше двух минут окно не появляется");
	g.step(20);
	assert.equal(g.fatal, null);
	const wrap = elements.get('mx-perf');
	assert.ok(wrap);
	const box = wrap.children[0], text = box.querySelector('#mx-perf-text').value;
	assert.match(text, /Длительность: 120\./);
	assert.match(text, /FPS средний/);
	assert.match(text, /update медиана\/p95/);
	assert.match(text, /draw [0-9]/);
	assert.match(text, /ПО ЭКРАНАМ И МИРАМ/);
	assert.match(text, /ПО СЕКУНДАМ/);
	assert.match(text, /\[0–1 с\] экран menu/);
	assert.match(text, /20 САМЫХ ДОЛГИХ КАДРОВ/);
	assert.match(text, /экран menu/);
	assert.match(text, /экран settings/);
	assert.match(text, /качество 0 \(ручное\)/);
	assert.match(text, /DPR 2, окно 1280×720, R/);
	assert.match(text, /User-Agent: node-harness/);
	box.querySelector('#mx-perf-copy').onclick();
	assert.match(box.querySelector('#mx-perf-msg').textContent, /вручную/);
	box.querySelector('#mx-perf-close').onclick();
	assert.equal(elements.has('mx-perf'), false);
	assert.equal(g.dev.run('PERF_REPORT === null'), true);
});

test("сворачивание отменяет замер", async () => {
	const dom = createDom(), g = boot({ dom });
	assert.ok(await g.ready());
	g.dev.run('perfReportStart()');
	dom.document.hidden = true;
	for (const f of dom.docListeners.visibilitychange) f();
	assert.equal(g.dev.run('PERF_REPORT === null'), true);
});


test("хронология относит задержку к предыдущему кадру и показывает переход и признаки события", async () => {
	const g = boot();
	assert.ok(await g.ready());
	g.dev.S = "map";
	g.dev.run(`PERF_REPORT = { start: 0, prev: null, samples: [] };
		perfReportFrame(100, 2, 3);
		ev({ title: "Находка", chest: 0 });
		perfReportFrame(150, 4, 5);
		EV.open = 1;
		perfReportFrame(180, 6, 7);`);
	const text = g.dev.run('perfReportText(PERF_REPORT)');
	assert.match(text, /50\.00 мс \(20\.00 FPS\); update 2\.00 мс, draw 3\.00 мс; экран map.*→ экран msg/);
	assert.match(text, /событие: Находка, сундук закрыт/);
	assert.match(text, /\[0–1 с\] экран map/);
	assert.match(text, /\[0–1 с\] экран msg/);
	assert.equal(g.dev.run('PERF_REPORT.samples.length'), 2);
});

test("признаки боя: победа и название способности, этап сборки карты", async () => {
	const g = boot();
	assert.ok(await g.ready());
	g.dev.newGame();
	g.dev.setSlot(0, g.dev.HEROES[0]);
	g.dev.fight("fight");
	g.dev.startFight();
	g.dev.run('F.out = { win: true, t: 1, d: 9 }; F.fx.push({ k: "cut", s: "Молния" });');
	assert.match(g.dev.run('perfReportActivity()'), /плашка победы/);
	assert.match(g.dev.run('perfReportActivity()'), /способность: Молния/);
	g.dev.run('bakeMap(123456)');
	assert.match(g.dev.run('perfReportActivity()'), /сборка карты: земля/);
});
