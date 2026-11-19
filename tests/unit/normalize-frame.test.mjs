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
	assert.equal(metrics.change, 0);
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

test("замкнутый островок хромакея удаляется, совпадение ключа с палитрой отклоняется", async () => {
	const c = createCanvas(32, 32), x = c.getContext("2d");
	x.fillStyle = "#ff00ff"; x.fillRect(0, 0, 32, 32);
	x.fillStyle = "#236b30"; x.fillRect(9, 5, 14, 22);
	x.fillStyle = "#ff00ff"; x.fillRect(14, 12, 4, 4);
	const result = await normalizeFrame(c.toBuffer("image/png"), fixture(), { width: 32, height: 32 });
	const im = await loadImage(result.png), out = createCanvas(32, 32), ctx = out.getContext("2d");
	ctx.drawImage(im, 0, 0);
	assert.equal(ctx.getImageData(15, 15, 1, 1).data[3], 0);
	await assert.rejects(() => normalizeFrame(fixture({key:true}), fixture({color:"#ff00ff"}), {width:32,height:32}), /хромакея/);
});

test("реальный кандидат мага: замкнутый хромакей не остаётся в PNG", async () => {
	const base = new URL("../../assets/generated_candidates/", import.meta.url);
	const { png } = await normalizeFrame(new URL("mage/walk_01_attempt3.png", base), new URL("references/mage.png", base), { width:58, height:68 });
	const im = await loadImage(png), c = createCanvas(im.width, im.height), x = c.getContext("2d"); x.drawImage(im, 0, 0);
	const p = x.getImageData(0, 0, im.width, im.height).data;
	for (let i = 0; i < p.length; i += 4) if (p[i + 3] > 0)
		assert.ok(Math.abs(255-p[i]) + p[i+1] + Math.abs(255-p[i+2]) > 150, "остаток цвета ключа");
});
