import test from "node:test";
import assert from "node:assert/strict";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { normalizeFrame } from "../../tools/lib/normalize-frame.mjs";
function fixture({ key = false, clipped = false, color = "#236b30" } = {}) {
	const c = createCanvas(32, 32), x = c.getContext("2d");
	if (key) { x.fillStyle = "#ff00ff"; x.fillRect(0, 0, 32, 32); }
	x.fillStyle = color; x.fillRect(clipped ? 0 : 9, 5, 14, 22);
	return c.toBuffer("image/png");
}
test("нормализация убирает хромакей, сохраняет прозрачные края и опору", async () => {
	const { png, metrics } = await normalizeFrame(fixture({ key: true }), fixture(), { width: 32, height: 32 });
	assert.equal(metrics.shape, 1);
	assert.equal(metrics.color, 0);
	const im = await loadImage(png), c = createCanvas(32, 32), x = c.getContext("2d"); x.drawImage(im, 0, 0);
	const p = x.getImageData(0, 0, 32, 32).data;
	assert.equal(p[3], 0);
	assert.equal(p[((29 * 32 + 16) * 4) + 3], 255);
	assert.equal(p[((31 * 32 + 16) * 4) + 3], 0);
});
test("обрезанный кадр, чужой цвет и неверный размер отклоняются", async () => {
	await assert.rejects(() => normalizeFrame(fixture({ key: true, clipped: true }), fixture(), { width: 32, height: 32 }), /обрезан/);
	await assert.rejects(() => normalizeFrame(fixture({ key: true, color: "#e8e8e8" }), fixture(), { width: 32, height: 32 }), /цвет/);
	await assert.rejects(() => normalizeFrame(fixture({ key: true }), fixture(), { width: 2, height: 32 }), /ширина/);
	await assert.rejects(() => normalizeFrame(Buffer.from("не PNG"), fixture(), { width: 32, height: 32 }), /PNG/);
	await assert.rejects(() => normalizeFrame(fixture({ key: true }), fixture(), { width: 32, height: 32, minShape: NaN }), /пороги/);
});
