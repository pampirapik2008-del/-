#!/usr/bin/env node
// Собирает единый index.html из src/ + assets/.
//   node tools/build.mjs           — записать index.html
//   node tools/build.mjs --check   — сравнить с текущим index.html (и с dist/*.html, если они есть) и выйти с кодом 1 при расхождении
//   node tools/build.mjs --dist    — дополнительно положить копию в dist/game.html и сборку без редактора в dist/game-public.html
// Сборка детерминирована: одни и те же входы дают побайтово тот же файл.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { buildHtml, gameFileList } from "./lib/assemble.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const out = path.join(ROOT, "index.html");

const html = buildHtml(ROOT);
const hash = crypto.createHash("sha256").update(html).digest("hex");
const sections = gameFileList(ROOT).length;

if (args.has("--check")) {
	const same = (file, want, must) => {
		const p = path.join(ROOT, file);
		if (!fs.existsSync(p)) {
			if (must) {
				console.error(`${file} отсутствует`);
				return false;
			}
			return true;
		}
		const cur = fs.readFileSync(p, "utf8");
		if (cur === want) return true;
		const i = [...want].findIndex((ch, k) => ch !== cur[k]);
		console.error(`сборка РАСХОДИТСЯ с ${file} (первое различие на смещении ${i})`);
		console.error(`  собрано ${want.length} символов, на диске ${cur.length}`);
		return false;
	};
	// index.html обязан совпадать; релизные копии в dist/ проверяются, если они собраны (npm run build:dist)
	const ok = same("index.html", html, true) & same("dist/game.html", html, false) & same("dist/game-public.html", buildHtml(ROOT, { public: true }), false) & same("dist/game-v2.html", buildHtml(ROOT, { v2: true }), false) & same("dist/game-v2-public.html", buildHtml(ROOT, { public: true, v2: true }), false);
	if (!ok) process.exit(1);
	console.log("сборка совпадает с index.html" + (fs.existsSync(path.join(ROOT, "dist/game-public.html")) ? " и dist/" : "") + ", sha256 " + hash.slice(0, 16));
	process.exit(0);
}

fs.writeFileSync(out, html);
if (args.has("--dist")) {
	fs.mkdirSync(path.join(ROOT, "dist"), { recursive: true });
	fs.writeFileSync(path.join(ROOT, "dist/game.html"), html);
	// сборка «для друзей»: те же игра и ресурсы, вместо редактора — src/runner.js
	const pub = buildHtml(ROOT, { public: true });
	const pubHash = crypto.createHash("sha256").update(pub).digest("hex");
	fs.writeFileSync(path.join(ROOT, "dist/game-public.html"), pub);
	// V2 отличается лишь значением по умолчанию; сохранённый выбор имеет приоритет.
	const v2 = buildHtml(ROOT, { v2: true }), v2pub = buildHtml(ROOT, { public: true, v2: true });
	fs.writeFileSync(path.join(ROOT, "dist/game-v2.html"), v2);
	fs.writeFileSync(path.join(ROOT, "dist/game-v2-public.html"), v2pub);
	const sum = (text) => crypto.createHash("sha256").update(text).digest("hex");
	// контрольные суммы релизных файлов — рядом, в формате sha256sum -c
	fs.writeFileSync(path.join(ROOT, "dist/SHA256SUMS.txt"), `${hash}  game.html\n${pubHash}  game-public.html\n${sum(v2)}  game-v2.html\n${sum(v2pub)}  game-v2-public.html\n`);
	console.log(`dist/game.html записан, sha256 ${hash} (dist/SHA256SUMS.txt)`);
	console.log(`dist/game-public.html записан: ${(pub.length / 1024 / 1024).toFixed(2)} МБ без редактора, sha256 ${pubHash}`);
}
console.log(`index.html собран: ${(html.length / 1024 / 1024).toFixed(2)} МБ, секций ${sections}, sha256 ${hash}`);
