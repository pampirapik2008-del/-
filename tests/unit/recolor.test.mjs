// recolor() считает цвет через словарь «RGB → RGB» (один пересчёт HSV на уникальный цвет, а не на
// пиксель). Байты результата должны совпадать с прежней попиксельной версией на всех атласах и всех
// наборах правил, которые использует игра (тинты миров, монстры, реквизит, торговец).
// Нужен настоящий холст (@napi-rs/canvas): у заглушки DOM нет пикселей.
import test from "node:test";
import assert from "node:assert/strict";
import { createDom } from "../harness/dom.mjs";
import { boot } from "../harness/boot.mjs";

const { createCanvas, Image } = await import("@napi-rs/canvas");
const real = () => boot({ dom: createDom({ dpr: 1, canvasFactory: (w, h) => createCanvas(w, h), ImageClass: Image }) });

// прежняя реализация, дословно (эталон)
const OLD = `function __recolorOld(img, rules) {
	const c = mkC(img.width, img.height),
		x = c.getContext("2d");
	x.drawImage(img, 0, 0);
	const d = x.getImageData(0, 0, c.width, c.height),
		p = d.data;
	for (let i = 0; i < p.length; i += 4) {
		if (!p[i + 3]) continue;
		const r = p[i] / 255, g = p[i + 1] / 255, b = p[i + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), df = mx - mn;
		let h = 0;
		if (df > 1e-5) h = mx === r ? ((g - b) / df + 6) % 6 : mx === g ? (b - r) / df + 2 : (r - g) / df + 4;
		h *= 60;
		let s = mx > 0 ? df / mx : 0, v = mx, hit = false;
		for (const q of rules) {
			if (q.gray) {
				if (s > 0.26 || v < 0.16) continue;
				h = q.to; s = q.sat; v = Math.min(1, v * (q.val || 1));
			} else {
				if (s < 0.14) continue;
				const lo = q.h[0], hi = q.h[1];
				if (lo <= hi ? h < lo || h > hi : h < lo && h > hi) continue;
				h = q.to; s = Math.min(1, s * (q.sat || 1)); v = Math.min(1, v * (q.val || 1));
			}
			hit = true;
			break;
		}
		if (!hit) continue;
		const cc = v * s, hh = (h % 360) / 60, xx = cc * (1 - Math.abs((hh % 2) - 1)), m = v - cc, k = hh | 0;
		const R1 = k === 0 || k === 5 ? cc : k === 1 || k === 4 ? xx : 0, G1 = k === 1 || k === 2 ? cc : k === 0 || k === 3 ? xx : 0, B1 = k === 3 || k === 4 ? cc : k === 2 || k === 5 ? xx : 0;
		p[i] = (R1 + m) * 255; p[i + 1] = (G1 + m) * 255; p[i + 2] = (B1 + m) * 255;
	}
	x.putImageData(d, 0, 0);
	return c;
}`;

// контрольная сумма пикселей холста + сколько пикселей изменилось относительно исходника
// (исходные пиксели атласа читаются один раз: getImageData в @napi-rs/canvas 1.1 течёт ~3 МБ на вызов)
const CMP = `(img, rules) => {
	const a = __recolorOld(img, rules), b = recolor(img, rules);
	const pa = a.getContext("2d").getImageData(0, 0, a.width, a.height).data, pb = b.getContext("2d").getImageData(0, 0, b.width, b.height).data;
	const ps = __srcPx.get(img) || (() => { const src = mkC(img.width, img.height); src.getContext("2d").drawImage(img, 0, 0); const d = src.getContext("2d").getImageData(0, 0, img.width, img.height).data; __srcPx.set(img, d); return d; })();
	let diff = 0, changed = 0;
	for (let i = 0; i < pa.length; i++) { if (pa[i] !== pb[i]) diff++; if (pa[i] !== ps[i]) changed++; }
	return { diff, changed, n: pa.length / 4, same: a.width === b.width && a.height === b.height };
}`;

test("recolor: байты совпадают с попиксельной версией на всех атласах и правилах игры", async () => {
	const g = real();
	assert.ok(await g.ready());
	g.step(3);
	g.dev.run(OLD + "; var __srcPx = new Map(); var __cmp = " + CMP);
	const cases = g.dev.run(`JSON.stringify([
		...WORLDS.map((w) => ["map " + w.id, "map", MAPT[w.id].tint]),
		...WORLDS.flatMap((w) => ["a", "m", "b", "boss"].map((k) => ["mob " + w.id + " " + k, "mobs", (() => { const im = mobImg(w, k); return im === IMG.mobs ? null : "rules"; })()])),
		...WORLDS.map((w) => ["props " + w.id, "props", w.pt]),
		["merch", "heroes", [{ h: [180, 262], to: 26, sat: 1, val: 1.05 }, { h: [80, 172], to: 288, sat: 0.85, val: 0.95 }]],
		["gray+hue", "heroes", [{ gray: 1, to: 210, sat: 0.08, val: 1.35 }, { h: [300, 40], to: 90, sat: 1.4, val: 1.3 }]],
		["wrap hue", "mobs", [{ h: [330, 30], to: 180, sat: 1, val: 1 }]],
	])`);
	let checked = 0,
		changedTotal = 0;
	for (const [name, atlas, rules] of JSON.parse(cases)) {
		if (rules === null) continue; // мир без тинта: mobImg отдаёт исходный атлас, recolor не зовётся
		const code =
			rules === "rules"
				? `(() => { const w = WORLDS.find((w) => "${name}".startsWith("mob " + w.id + " ")); const key = "${name}".split(" ")[2];
					const q = w.tM || { to: (w.tA ? w.tA.to : 120) + 14, sat: (w.tA ? w.tA.sat : 1) * 0.9, val: (w.tA ? w.tA.val : 1) * 0.62 };
					const rules = key === "m" ? [{ h: GREEN_H, ...q }] : []; if (key !== "m" && w.tA) rules.push({ h: GREEN_H, ...w.tA }); if (w.tB) rules.push({ h: RED_H, ...w.tB });
					return JSON.stringify(__cmp(IMG.${atlas}, rules)); })()`
				: `JSON.stringify(__cmp(IMG.${atlas}, ${JSON.stringify(rules)}))`;
		const r = JSON.parse(g.dev.run(code));
		assert.ok(r.same, name + ": размер холста");
		assert.equal(r.diff, 0, name + ": расхождений байтов " + r.diff + " из " + r.n * 4);
		checked++;
		changedTotal += r.changed;
	}
	assert.ok(checked >= 20, "проверено наборов: " + checked);
	assert.ok(changedTotal > 0, "перекраска вообще что-то меняет");
	assert.equal(g.dev.errs().length, 0);
});

test("recolor: пустые правила и прозрачные пиксели — исходник без изменений, альфа не трогается", async () => {
	const g = real();
	assert.ok(await g.ready());
	g.step(3);
	const r = JSON.parse(
		g.dev.run(`JSON.stringify((() => {
			const img = IMG.mobs, out = recolor(img, []), src = mkC(img.width, img.height);
			src.getContext("2d").drawImage(img, 0, 0);
			const a = out.getContext("2d").getImageData(0, 0, img.width, img.height).data, b = src.getContext("2d").getImageData(0, 0, img.width, img.height).data;
			let diff = 0, alphaDiff = 0, transparent = 0;
			const t = recolor(img, [{ h: [0, 360], to: 0, sat: 1, val: 1 }]).getContext("2d").getImageData(0, 0, img.width, img.height).data;
			for (let i = 0; i < a.length; i += 4) { for (let k = 0; k < 4; k++) if (a[i + k] !== b[i + k]) diff++; if (t[i + 3] !== b[i + 3]) alphaDiff++; if (!b[i + 3]) transparent++; }
			return { diff, alphaDiff, transparent };
		})())`)
	);
	assert.equal(r.diff, 0, "без правил — копия");
	assert.equal(r.alphaDiff, 0, "альфа сохраняется при любой перекраске");
	assert.ok(r.transparent > 0);
});
