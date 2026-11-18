#!/usr/bin/env node
// E2E без браузера: тур по всем экранам на настоящем canvas (@napi-rs/canvas) + попиксельное
// сравнение ключевых экранов с эталоном tests/e2e/baseline (допуск 0,5 %).
//   node tools/e2e.mjs                 — тур по сборке из src/ (как в браузере, но headless)
//   node tools/e2e.mjs --html dist/game.html   — тур по готовому монолиту
//   node tools/e2e.mjs --record        — переснять эталон (осознанно, см. docs/DECISIONS.md)
// Это основная, детерминированная проверка без браузера: тот же код, тот же шрифт, та же растеризация
// 2D-канваса. События браузера (мышь, тач с поворотом, клавиатура, DOM-окна) проверяет
// tools/browser-tour.mjs в настоящем Chromium (ставится отдельно: npm run browser:setup).
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const html = args.includes("--html") ? args[args.indexOf("--html") + 1] : null;
const record = args.includes("--record");
const BASE = path.join(ROOT, "tests/e2e/baseline");
const out = fs.mkdtempSync(path.join(os.tmpdir(), "e2e-shots-"));

const run = (cmd, a) => spawnSync(process.execPath, [cmd, ...a], { stdio: "inherit", cwd: ROOT });

const tour = run(path.join(ROOT, "tools/shots.mjs"), ["--out", out, ...(html ? ["--html", html] : [])]);
if (tour.status !== 0) {
	console.error("e2e: тур не прошёл (ошибки консоли или падение)");
	process.exit(1);
}
if (record) {
	fs.mkdirSync(BASE, { recursive: true });
	for (const f of fs.readdirSync(BASE)) fs.rmSync(path.join(BASE, f));
	const keep = ["02_menu", "03_pick", "05_map", "07_event_chest", "12_prep_placed", "13_fight", "18_shop", "22_boss_fight", "31_codex", "34_settings"];
	for (const k of keep) fs.copyFileSync(path.join(out, k + ".png"), path.join(BASE, k + ".png"));
	console.log("эталон e2e переснят:", keep.length, "снимков →", BASE);
	process.exit(0);
}
const diff = run(path.join(ROOT, "tools/shotdiff.mjs"), [BASE, out, "--tol", "0.5"]);
console.log("все снимки тура:", out);
process.exit(diff.status);
