#!/usr/bin/env node
// Пример: node tools/split-sprite-sheet.mjs --input лист.png --columns 4 --rows 2 --out-dir work/sheet-probe
import fs from "node:fs/promises";
import path from "node:path";
import { splitSpriteSheet } from "./lib/split-sprite-sheet.mjs";

const args = process.argv.slice(2), options = {};
for (let i = 0; i < args.length; i += 2) {
	const key = args[i], value = args[i + 1];
	if (!["--input", "--columns", "--rows", "--trim-top", "--row-edges", "--out-dir"].includes(key) || !value || value.startsWith("--") || key in options) throw new Error("неверные аргументы");
	options[key] = value;
}
if (!["--input", "--columns", "--rows", "--out-dir"].every(key => key in options)) throw new Error("нужны --input, --columns, --rows и --out-dir");
const frames = await splitSpriteSheet(options["--input"], { columns: Number(options["--columns"]), rows: Number(options["--rows"]), trimTop: Number(options["--trim-top"] ?? 0), rowEdges: options["--row-edges"]?.split(",").map(Number) });
const dir = options["--out-dir"];
// Никогда не перезаписываем ранее обработанные кадры.
await fs.mkdir(dir);
for (let i = 0; i < frames.length; i++) await fs.writeFile(path.join(dir, `frame_${String(i + 1).padStart(3, "0")}.png`), frames[i].png, { flag: "wx" });
console.log(`Вырезано ${frames.length} ячеек в ${dir}. Это только кандидаты: проверьте границы, нумерацию, фон и последовательность вручную.`);
