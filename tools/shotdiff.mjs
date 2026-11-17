#!/usr/bin/env node
// Попиксельное сравнение двух наборов скриншотов (tools/shots.mjs) с допуском.
//   node tools/shotdiff.mjs <папка-эталон> <папка-сейчас> [--tol 0.5] [--out <папка для diff-картинок>]
// Пиксель считается отличающимся, если любой канал отличается больше чем на 8 из 255.
// Снимок проходит, если доля отличающихся пикселей ≤ tol % (по умолчанию 0,5 %).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createCanvas, loadImage } = require("@napi-rs/canvas");

const args = process.argv.slice(2);
const dirs = args.filter((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--tol" && args[args.indexOf(a) - 1] !== "--out");
const val = (f, d) => {
	const i = args.indexOf(f);
	return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const TOL = Number(val("--tol", 0.5));
const OUT = val("--out", null);
if (dirs.length < 2) {
	console.error("нужно две папки: эталон и текущая");
	process.exit(2);
}
const [A, B] = dirs;

async function pixels(file) {
	const img = await loadImage(file);
	const c = createCanvas(img.width, img.height),
		x = c.getContext("2d");
	x.drawImage(img, 0, 0);
	return { w: img.width, h: img.height, d: x.getImageData(0, 0, img.width, img.height).data };
}

async function main() {
	const files = fs
		.readdirSync(A)
		.filter((f) => f.endsWith(".png"))
		.sort();
	if (OUT) fs.mkdirSync(OUT, { recursive: true });
	let bad = 0,
		missing = 0;
	const rows = [];
	for (const f of files) {
		const pb = path.join(B, f);
		if (!fs.existsSync(pb)) {
			missing++;
			rows.push([f, "нет снимка"]);
			continue;
		}
		const a = await pixels(path.join(A, f)),
			b = await pixels(pb);
		if (a.w !== b.w || a.h !== b.h) {
			bad++;
			rows.push([f, `размер ${a.w}×${a.h} ≠ ${b.w}×${b.h}`]);
			continue;
		}
		let diff = 0;
		const n = a.w * a.h;
		let dc = null;
		if (OUT) dc = createCanvas(a.w, a.h).getContext("2d");
		const dd = dc ? dc.createImageData(a.w, a.h) : null;
		for (let i = 0; i < n; i++) {
			const o = i * 4;
			const dr = Math.abs(a.d[o] - b.d[o]),
				dg = Math.abs(a.d[o + 1] - b.d[o + 1]),
				db = Math.abs(a.d[o + 2] - b.d[o + 2]);
			const isDiff = dr > 8 || dg > 8 || db > 8;
			if (isDiff) diff++;
			if (dd) {
				const g = (a.d[o] + a.d[o + 1] + a.d[o + 2]) / 3;
				dd.data[o] = isDiff ? 255 : g * 0.35;
				dd.data[o + 1] = isDiff ? 40 : g * 0.35;
				dd.data[o + 2] = isDiff ? 40 : g * 0.35;
				dd.data[o + 3] = 255;
			}
		}
		const pct = (diff / n) * 100;
		const ok = pct <= TOL;
		if (!ok) bad++;
		rows.push([f, (ok ? "ok   " : "FAIL ") + pct.toFixed(3) + " %"]);
		if (dd && !ok) {
			dc.putImageData(dd, 0, 0);
			fs.writeFileSync(path.join(OUT, f.replace(/\.png$/, ".diff.png")), dc.canvas.toBuffer("image/png"));
		}
	}
	for (const [f, r] of rows) console.log(r.padEnd(14), f);
	console.log(`снимков ${files.length}, в допуске ${files.length - bad - missing}, вне допуска ${bad}, нет пары ${missing} (допуск ${TOL} %)`);
	process.exit(bad || missing ? 1 : 0);
}
main().catch((e) => {
	console.error("FAIL:", e);
	process.exit(1);
});
