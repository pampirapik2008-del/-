// Очистка хромакея и проверка кандидата: изображения персонажей создаёт генератор, не этот код.
import { createCanvas, loadImage } from "@napi-rs/canvas";
import fs from "node:fs/promises";

async function pngImage(input) {
	const data = Buffer.isBuffer(input) ? input : await fs.readFile(input);
	if (data.length < 8 || !data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error("ожидается PNG");
	return loadImage(data);
}

const key = (r, g, b) => Math.abs(255 - r) + g + Math.abs(255 - b) <= 150;
function checkReference(image) {
	const c = createCanvas(image.width, image.height), x = c.getContext("2d");
	x.drawImage(image, 0, 0);
	const pixels = x.getImageData(0, 0, image.width, image.height).data;
	for (let i = 0; i < pixels.length; i += 4)
		if (pixels[i + 3] >= 128 && key(pixels[i], pixels[i + 1], pixels[i + 2])) throw new Error("цвет хромакея встречается в образце");
}
function extract(image, chroma) {
	if (image.width > 4096 || image.height > 4096) throw new Error("изображение слишком большое");
	const c = createCanvas(image.width, image.height), ctx = c.getContext("2d");
	ctx.drawImage(image, 0, 0);
	const pixels = ctx.getImageData(0, 0, image.width, image.height), data = pixels.data;
	const w = image.width, h = image.height, background = new Uint8Array(w * h);
	if (chroma) {
		const q = new Int32Array(w * h); let read = 0, write = 0;
		const push = (i) => {
			if (background[i]) return;
			const k = i * 4;
			if (data[k + 3] && !key(data[k], data[k + 1], data[k + 2])) return;
			background[i] = 1; q[write++] = i;
		};
		for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
		for (let y = 1; y < h - 1; y++) { push(y * w); push(y * w + w - 1); }
		while (read < write) {
			const i = q[read++], x = i % w, y = (i / w) | 0;
			if (x) push(i - 1); if (x + 1 < w) push(i + 1);
			if (y) push(i - w); if (y + 1 < h) push(i + w);
		}
		for (let i = 0; i < background.length; i++) if (background[i]) data[i * 4 + 3] = 0;
	}
	// Замкнутые островки фона тоже удаляются. Образец проверен на конфликт,
	// но новые детали кандидата могли быть удалены: нужен ручной просмотр.
	if (chroma) for (let i = 0; i < data.length; i += 4) if (key(data[i], data[i + 1], data[i + 2])) data[i + 3] = 0;
	let left = w, top = h, right = -1, bottom = -1;
	for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
		if (data[(y * w + x) * 4 + 3] < 128) continue;
		left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
	}
	if (right < left) throw new Error("пустой кадр");
	if (chroma && (left === 0 || top === 0 || right === w - 1 || bottom === h - 1)) throw new Error("персонаж обрезан краем изображения");
	ctx.putImageData(pixels, 0, 0);
	return { c, left, top, width: right - left + 1, height: bottom - top + 1 };
}
function fit(part, width, height) {
	const c = createCanvas(width, height), x = c.getContext("2d");
	const scale = Math.min((width - 4) / part.width, (height - 4) / part.height);
	const w = Math.max(1, Math.round(part.width * scale)), h = Math.max(1, Math.round(part.height * scale));
	x.imageSmoothingEnabled = false;
	x.drawImage(part.c, part.left, part.top, part.width, part.height, Math.round((width - w) / 2), height - 2 - h, w, h);
	return c;
}
function compare(candidate, reference) {
	const w = candidate.width, h = candidate.height;
	const a = candidate.getContext("2d").getImageData(0, 0, w, h).data, b = reference.getContext("2d").getImageData(0, 0, w, h).data;
	let intersection = 0, union = 0, changed = 0, colorSum = 0, count = 0;
	const colors = new Map();
	for (let i = 0; i < b.length; i += 4) if (b[i + 3] >= 128) {
		const id = (b[i] << 16) | (b[i + 1] << 8) | b[i + 2];
		if (!colors.has(id)) colors.set(id, [b[i], b[i + 1], b[i + 2]]);
	}
	const all = [...colors.values()], stride = Math.max(1, Math.ceil(all.length / 512));
	const palette = all.filter((_, i) => i % stride === 0);
	for (let i = 0; i < a.length; i += 4) {
		const aa = a[i + 3] >= 128, bb = b[i + 3] >= 128;
		if (aa || bb) {
			union++;
			if (aa !== bb || Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 60) changed++;
		}
		if (aa && bb) intersection++;
		if (!aa) continue;
		let best = Infinity;
		for (const p of palette) best = Math.min(best, (a[i] - p[0]) ** 2 + (a[i + 1] - p[1]) ** 2 + (a[i + 2] - p[2]) ** 2);
		colorSum += Math.sqrt(best / 3); count++;
	}
	return { shape: union ? intersection / union : 0, color: count ? colorSum / count : Infinity, change: union ? changed / union : 0 };
}
export async function normalizeFrame(input, reference, { width, height, minShape = 0.35, maxColor = 60 } = {}) {
	if (!Number.isInteger(width) || !Number.isInteger(height) || width < 8 || height < 8 || width > 512 || height > 512) throw new Error("ширина и высота: целые числа от 8 до 512");
	if (!Number.isFinite(minShape) || minShape < 0 || minShape > 1 || !Number.isFinite(maxColor) || maxColor < 0) throw new Error("неверные пороги проверки");
	const [source, ref] = await Promise.all([pngImage(input), pngImage(reference)]);
	if (ref.width > 4096 || ref.height > 4096) throw new Error("образец слишком большой");
	checkReference(ref);
	const result = fit(extract(source, true), width, height), baseline = fit(extract(ref, false), width, height);
	const metrics = compare(result, baseline);
	if (metrics.shape < minShape) throw new Error(`силуэт не прошёл: ${metrics.shape.toFixed(3)} < ${minShape}`);
	if (metrics.color > maxColor) throw new Error(`цвет не прошёл: ${metrics.color.toFixed(2)} > ${maxColor}`);
	return { png: result.toBuffer("image/png"), metrics };
}
