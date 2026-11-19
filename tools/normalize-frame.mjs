#!/usr/bin/env node
// Пример: node tools/normalize-frame.mjs --input кандидат.png --ref образец.png --out кадр.png --width 64 --height 72
import fs from "node:fs";
import path from "node:path";
import { normalizeFrame } from "./lib/normalize-frame.mjs";
const args = process.argv.slice(2), opt = (name) => args[args.indexOf(name) + 1];
if (!["--input", "--ref", "--out", "--width", "--height"].every(k => args.includes(k) && opt(k))) throw new Error("нужны --input, --ref, --out, --width и --height");
const out = opt("--out");
if (!out.toLowerCase().endsWith(".png")) throw new Error("выход должен быть PNG");
const { png, metrics } = await normalizeFrame(opt("--input"), opt("--ref"), { width: Number(opt("--width")), height: Number(opt("--height")) });
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, png);
console.log(`готово: ${out}; пересечение силуэтов ${metrics.shape.toFixed(3)}, отклонение цвета ${metrics.color.toFixed(2)}`);
