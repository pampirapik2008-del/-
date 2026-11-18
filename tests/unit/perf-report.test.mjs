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

test("замер через loop: 20 секунд, условия, окно, копирование и закрытие", async () => {
	const dom = createDom(), g = boot({ dom });
	assert.ok(await g.ready());
	const elements = reportDom(dom);
	dom.windowObj.performance.now = () => 0;
	g.dev.run('perfReportStart()');
	g.step(600);
	assert.equal(elements.has('mx-perf'), false);
	g.dev.run('setQ(0); Machine.go("settings")');
	g.step(610);
	assert.equal(g.fatal, null);
	const wrap = elements.get('mx-perf');
	assert.ok(wrap);
	const box = wrap.children[0], text = box.querySelector('#mx-perf-text').value;
	assert.match(text, /FPS: медиана/);
	assert.match(text, /Update: медиана/);
	assert.match(text, /Draw: медиана/);
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
