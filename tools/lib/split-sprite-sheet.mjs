// Деление готового листа по сетке: без генерации и очистки фона; PNG декодируется и перекодируется.
import fs from "node:fs/promises";
import { createCanvas, loadImage } from "@napi-rs/canvas";

export async function splitSpriteSheet(input, { columns, rows, trimTop = 0, rowEdges } = {}) {
	for (const [name, value, min, max] of [["columns", columns, 1, 32], ["rows", rows, 1, 32], ["trimTop", trimTop, 0, 4095]]) {
		if (!Number.isInteger(value) || value < min || value > max) throw new Error(`неверное значение ${name}`);
	}
	if (columns * rows > 256) throw new Error("на листе допускается не более 256 ячеек");
	const data = Buffer.isBuffer(input) ? input : await fs.readFile(input);
	if (data.length < 8 || !data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error("ожидается PNG");
	const im = await loadImage(data);
	if (im.width > 4096 || im.height > 4096 || im.width < columns || im.height < rows) throw new Error("неподходящий размер листа");
	if (rowEdges !== undefined && (!Array.isArray(rowEdges) || rowEdges.length !== rows + 1 || rowEdges[0] !== 0 || rowEdges[rows] !== im.height || rowEdges.some((n, i) => !Number.isInteger(n) || (i > 0 && n <= rowEdges[i - 1])))) throw new Error("неверные границы строк");
	const frames = [];
	for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
		// Доли координат не накапливают ошибку на листах, размеры которых не кратны сетке.
		const x = Math.floor(im.width * column / columns), right = Math.floor(im.width * (column + 1) / columns);
		const y = rowEdges ? rowEdges[row] : Math.floor(im.height * row / rows), bottom = rowEdges ? rowEdges[row + 1] : Math.floor(im.height * (row + 1) / rows);
		if (y + trimTop >= bottom) throw new Error("обрезка занимает всю ячейку");
		const width = right - x, height = bottom - y - trimTop;
		const canvas = createCanvas(width, height), ctx = canvas.getContext("2d");
		ctx.imageSmoothingEnabled = false;
		ctx.drawImage(im, x, y + trimTop, width, height, 0, 0, width, height);
		frames.push({ row, column, x, y: y + trimTop, width, height, png: canvas.toBuffer("image/png") });
	}
	return frames;
}
