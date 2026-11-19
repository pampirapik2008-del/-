import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { splitSpriteSheet } from "../../tools/lib/split-sprite-sheet.mjs";

function sheet() {
	const c = createCanvas(11, 7), x = c.getContext("2d");
	for (let row = 0; row < 2; row++) for (let col = 0; col < 3; col++) {
		const left = Math.floor(11 * col / 3), top = Math.floor(7 * row / 2);
		x.fillStyle = `rgb(${30 + row * 90 + col * 20},20,30)`;
		x.fillRect(left, top, Math.floor(11 * (col + 1) / 3) - left, Math.floor(7 * (row + 1) / 2) - top);
	}
	return c.toBuffer("image/png");
}
async function pixel(png) {
	const image = await loadImage(png), c = createCanvas(image.width, image.height), x = c.getContext("2d");
	x.drawImage(image, 0, 0); return [...x.getImageData(0, 0, 1, 1).data];
}
test("лист делится слева направо и сверху вниз без накопления ошибки сетки", async () => {
	const frames = await splitSpriteSheet(sheet(), { columns: 3, rows: 2 });
	assert.equal(frames.length, 6);
	assert.deepEqual(frames.map(f => [f.x, f.y, f.width, f.height]), [[0,0,3,3],[3,0,4,3],[7,0,4,3],[0,3,3,4],[3,3,4,4],[7,3,4,4]]);
	assert.deepEqual(await pixel(frames[4].png), [140,20,30,255]);
});
test("обрезка верха явная; некорректные входы отклоняются", async () => {
	const frames = await splitSpriteSheet(sheet(), { columns: 3, rows: 2, trimTop: 1 });
	assert.equal(frames[0].y, 1); assert.equal(frames[0].height, 2);
	await assert.rejects(() => splitSpriteSheet(sheet(), {columns:3,rows:2,trimTop:3}), /обрезка/);
	await assert.rejects(() => splitSpriteSheet(sheet(), {columns:0,rows:2}), /columns/);
	await assert.rejects(() => splitSpriteSheet(sheet(), {columns:3,rows:1.5}), /rows/);
	await assert.rejects(() => splitSpriteSheet(Buffer.from("не PNG"), {columns:3,rows:2}), /PNG/);
});

test("явные границы строк позволяют делить неравномерные ряды", async () => {
	const frames = await splitSpriteSheet(sheet(), {columns:3, rows:2, rowEdges:[0,2,7]});
	assert.equal(frames[0].height, 2); assert.equal(frames[3].y, 2); assert.equal(frames[3].height, 5);
	await assert.rejects(() => splitSpriteSheet(sheet(), {columns:3,rows:2,rowEdges:[0,0,7]}), /границы/);
	await assert.rejects(() => splitSpriteSheet(sheet(), {columns:3,rows:2,rowEdges:[0,3,6]}), /границы/);
});

test("CLI не перезаписывает существующую папку и кадры", async () => {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-sheet-"));
	try {
		const input = path.join(dir, "input.png"), out = path.join(dir, "out");
		await fs.writeFile(input, sheet());
		const args = ["tools/split-sprite-sheet.mjs", "--input", input, "--columns", "3", "--rows", "2", "--out-dir", out];
		assert.equal(spawnSync(process.execPath, args).status, 0);
		assert.equal((await fs.readdir(out)).length, 6);
		const before = await fs.readFile(path.join(out, "frame_001.png"));
		assert.notEqual(spawnSync(process.execPath, args).status, 0);
		assert.deepEqual(await fs.readFile(path.join(out, "frame_001.png")), before);
	} finally { await fs.rm(dir, { recursive:true, force:true }); }
});
