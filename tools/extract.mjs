#!/usr/bin/env node
// Разовая операция: разбирает единый index.html на части.
//   src/shell.html          — HTML-оболочка с метками @@ASSETS@@ / @@SRC@@ / @@LOADER@@
//   src/editor/loader.js    — загрузчик + встроенный ИИ-редактор (не правится автоматикой)
//   src/game/*.js           — код игры по секциям (порядок = имя файла)
//   assets/img/*.png        — арты, декодированные из base64
//   assets/atlas.json       — атлас кадров (как есть, чтобы сборка совпадала байт-в-байт)
//   assets/font.woff2       — шрифт игры
//   assets/asset-manifest.json — соответствие ключ ASSET -> файл
//
// Повторный запуск перезаписывает файлы только с флагом --force:
// после первого раза источником правды становится src/, а index.html — результатом сборки.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const force = process.argv.includes("--force");
const abs = (p) => path.join(ROOT, p);
const read = (p) => fs.readFileSync(abs(p), "utf8");
const write = (p, s) => {
	fs.mkdirSync(path.dirname(abs(p)), { recursive: true });
	fs.writeFileSync(abs(p), s);
};
const writeBin = (p, b) => {
	fs.mkdirSync(path.dirname(abs(p)), { recursive: true });
	fs.writeFileSync(abs(p), b);
};

if (fs.existsSync(abs("src/game")) && !force) {
	console.error("src/game уже существует. Для перезаписи: node tools/extract.mjs --force");
	process.exit(1);
}

const html = read("index.html");
const AT = '<script type="text/plain" id="game-assets">';
const ST = '<script type="text/plain" id="game-src">';
const aOpen = html.indexOf(AT);
const sOpen = html.indexOf(ST);
const lOpen = html.lastIndexOf("<script>");
if (aOpen < 0 || sOpen < 0 || lOpen < 0 || lOpen < sOpen) throw new Error("не найдены секции index.html");
const aClose = html.indexOf("</script>", aOpen);
const sClose = html.indexOf("</script>", sOpen);
const lClose = html.indexOf("</script>", lOpen);

const assetsText = html.slice(aOpen + AT.length, aClose);
const srcText = html.slice(sOpen + ST.length, sClose);
const loaderText = html.slice(lOpen + "<script>".length, lClose);

/* ---------- 1. оболочка ---------- */
const shell =
	html.slice(0, aOpen + AT.length) +
	"@@ASSETS@@" +
	html.slice(aClose, sOpen + ST.length) +
	"@@SRC@@" +
	html.slice(sClose, lOpen + "<script>".length) +
	"@@LOADER@@" +
	html.slice(lClose);
write("src/shell.html", shell);
write("src/editor/loader.js", loaderText);

/* ---------- 2. ресурсы ---------- */
const am = /^"use strict";\nconst ASSET = ([\s\S]*?);\nconst ATLAS = ([\s\S]*?);\n$/.exec(assetsText);
if (!am) throw new Error("не разобрал #game-assets");
const ASSET = JSON.parse(am[1]);
const manifest = {};
for (const [k, v] of Object.entries(ASSET)) {
	const m = /^data:([^;]+);base64,([\s\S]*)$/.exec(v);
	if (!m) throw new Error("не data-uri у ключа " + k);
	const ext = m[1] === "image/png" ? "png" : m[1] === "image/jpeg" ? "jpg" : "bin";
	const file = `assets/img/${k}.${ext}`;
	writeBin(file, Buffer.from(m[2], "base64"));
	manifest[k] = { file, mime: m[1] };
}
write("assets/asset-manifest.json", JSON.stringify(manifest, null, 2) + "\n");
// атлас оставляем текстом: в нём есть числа вида 46.0, которые JSON.stringify не сохранит
write("assets/atlas.json", am[2]);

const fm = /^const FONT_URI = "data:font\/woff2;base64,([A-Za-z0-9+/=]+)";\n/.exec(srcText);
if (!fm) throw new Error("не разобрал FONT_URI");
writeBin("assets/font.woff2", Buffer.from(fm[1], "base64"));

/* ---------- 3. код по секциям ---------- */
const body = srcText.slice(fm[0].length);
const markerRe = /^\/\/ ===== (\d+_[a-z0-9]+)\.js =====$/gm;
const marks = [];
let mm;
while ((mm = markerRe.exec(body))) marks.push({ name: mm[1], start: mm.index });

const chunks = [];
if (marks.length === 0 || marks[0].start > 0) {
	chunks.push({ name: "01_head", text: body.slice(0, marks.length ? marks[0].start : body.length) });
}
marks.forEach((m, i) => {
	const end = i + 1 < marks.length ? marks[i + 1].start : body.length;
	chunks.push({ name: m.name, text: body.slice(m.start, end) });
});

const FONT_PLACEHOLDER = '@@FONT_BASE64@@';
write("src/game/00_font.js", `const FONT_URI = "data:font/woff2;base64,${FONT_PLACEHOLDER}";\n`);
for (const c of chunks) write(`src/game/${c.name}.js`, c.text);

/* ---------- 4. самопроверка: обратная склейка даёт исходник ---------- */
const rebuilt =
	`const FONT_URI = "data:font/woff2;base64,${fm[1]}";\n` + chunks.map((c) => c.text).join("");
if (rebuilt !== srcText) {
	const at = [...srcText].findIndex((ch, i) => ch !== rebuilt[i]);
	throw new Error(`склейка не совпала с исходником на смещении ${at}`);
}
const rebuiltAssets =
	'"use strict";\nconst ASSET = ' + JSON.stringify(ASSET) + ";\nconst ATLAS = " + am[2] + ";\n";
if (rebuiltAssets !== assetsText) throw new Error("склейка ресурсов не совпала с исходником");

const kb = (n) => (n / 1024).toFixed(1) + " КБ";
console.log("оболочка      ", kb(shell.length));
console.log("загрузчик     ", kb(loaderText.length));
console.log("ресурсы       ", Object.keys(manifest).length, "файлов,", kb(Object.values(manifest).reduce((s, m) => s + fs.statSync(abs(m.file)).size, 0)));
console.log("шрифт         ", kb(fs.statSync(abs("assets/font.woff2")).size));
for (const c of chunks) console.log("  src/game/" + c.name + ".js", kb(c.text.length), "|", c.text.split("\n").length, "строк");
console.log("обратная склейка: код OK, ресурсы OK");
