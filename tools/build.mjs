#!/usr/bin/env node
// Собирает единый index.html из src/ + assets/.
//   node tools/build.mjs           — записать index.html
//   node tools/build.mjs --check   — сравнить с текущим index.html и выйти с кодом 1 при расхождении
//   node tools/build.mjs --dist    — дополнительно положить копию в dist/game.html
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
	const cur = fs.existsSync(out) ? fs.readFileSync(out, "utf8") : "";
	if (cur === html) {
		console.log("сборка совпадает с index.html, sha256 " + hash.slice(0, 16));
		process.exit(0);
	}
	const i = [...html].findIndex((ch, k) => ch !== cur[k]);
	console.error(`сборка РАСХОДИТСЯ с index.html (первое различие на смещении ${i})`);
	console.error(`  собрано ${html.length} символов, на диске ${cur.length}`);
	process.exit(1);
}

fs.writeFileSync(out, html);
if (args.has("--dist")) {
	fs.mkdirSync(path.join(ROOT, "dist"), { recursive: true });
	fs.writeFileSync(path.join(ROOT, "dist/game.html"), html);
	console.log("dist/game.html записан");
}
console.log(`index.html собран: ${(html.length / 1024 / 1024).toFixed(2)} МБ, секций ${sections}, sha256 ${hash}`);
