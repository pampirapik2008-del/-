#!/usr/bin/env node
// Диагностика плашки победы: Chromium с принудительным readback (программная растеризация).
// Это не профиль телефона/GPU: сравниваются компоненты одного зафиксированного кадра.
//   npm run browser:setup && node tools/profile-victory.mjs [--frames 60]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launch } from "./lib/browser.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2), at = args.indexOf("--frames");
const frames = at < 0 ? 60 : Number(args[at + 1]);
if (!Number.isInteger(frames) || frames < 10 || frames > 1000) throw new Error("--frames: целое число от 10 до 1000");
const browser = await launch();
try {
	const page = await browser.newPage(), errors = [];
	page.on("pageerror", (e) => errors.push(String(e)));
	page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
	await page.setViewport({ width: 1218, height: 540, deviceScaleFactor: 1 });
	await page.goto(pathToFileURL(path.join(root, "index.html")).href);
	await page.waitForFunction("typeof READY !== 'undefined' && READY && G", { timeout: 30000 });
	await page.addScriptTag({ content: fs.readFileSync(path.join(root, "tests/harness/devapi.js"), "utf8") });
	const result = await page.evaluate((n) => __dev.run(`(() => {
		__dev.seed(777); __dev.newGame();
		for (let k = 0; k < 8; k++) __dev.setSlot(k, k < 4 ? __dev.HEROES[k] : null);
		__dev.setWorld(3, 9); __dev.fight("fight"); __dev.startFight();
		setQ(0); hiDpi();
		F.out = { win: true, t: 1, d: 100 };
		const victory = F.out, oldGlow = glow, oldTxo = txo;
		const variants = ["исходный бой", "победа", "победа без свечения", "победа без текста"];
		const all = Object.fromEntries(variants.map(x => [x, []]));
		try {
			for (let round = 0; round < ${n} + 8; round++) {
				for (let j = 0; j < variants.length; j++) {
					const v = variants[(j + round) % variants.length];
					F.out = v === "исходный бой" ? null : victory;
					glow = v === "победа без свечения" ? function(x,y,r,c,a) { if (x !== 609 || y !== 200 || r !== 320) return oldGlow(x,y,r,c,a); } : oldGlow;
					txo = v === "победа без текста" ? function(s,...a) { if (s !== "ПОБЕДА!") return oldTxo(s,...a); } : oldTxo;
					const t0 = performance.now(); draw(); ctx.getImageData(0, 0, 1, 1);
					const ms = performance.now() - t0;
					if (round >= 8) all[v].push(ms);
				}
			}
		} finally { glow = oldGlow; txo = oldTxo; F.out = victory; }
		return JSON.stringify(all);
	})()`), frames);
	const data = JSON.parse(result);
	const gameErrors = await page.evaluate(() => __dev.errs());
	if (errors.length || gameErrors.length) throw new Error("ошибки браузера/игры: " + JSON.stringify({ errors, gameErrors }));
	console.log("Chromium, программная растеризация + readback, низкое качество, R=1; кадров на вариант: " + frames);
	for (const [name, values] of Object.entries(data)) {
		values.sort((a, b) => a - b);
		console.log(name.padEnd(24), "медиана", values[Math.floor(values.length / 2)].toFixed(2), "мс, p95", values[Math.ceil(values.length * 0.95) - 1].toFixed(2), "мс");
	}
} finally {
	await browser.close();
}
