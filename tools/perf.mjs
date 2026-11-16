#!/usr/bin/env node
// Замер кадра: сколько занимает симуляция и отрисовка.
//   node tools/perf.mjs [--frames 900] [--json]
// ВАЖНО: canvas в обвязке — заглушка, поэтому время draw — это JS-часть игрового кода
// (вызовы, ветвления, подготовка), без растеризации GPU/CPU. Абсолютные числа браузера
// будут выше; для сравнения «до/после» рефакторинга этого достаточно.
import { boot } from "../tests/harness/boot.mjs";

const args = process.argv.slice(2);
const i = args.indexOf("--frames");
const FRAMES = i >= 0 ? Number(args[i + 1]) : 900;
const asJson = args.includes("--json");

const g = boot();
if (!(await g.ready())) throw new Error("игра не загрузилась");
g.step(5);

// бой среднего размера: 4 бойца против обычной волны
g.dev.seed(777);
g.dev.newGame();
for (let k = 0; k < 8; k++) g.dev.setSlot(k, null);
for (let k = 0; k < 4; k++) g.dev.setSlot(k, g.dev.HEROES[k]);
g.dev.setWorld(0, 4);
g.dev.fight("fight");
g.dev.startFight();

// прогрев на бою, чтобы JIT успел скомпилировать горячие функции
g.step(120);
g.dev.instrument(true);
const t = g.dev.timers;
const before = { upd: t.upd, draw: t.draw, n: t.n };
let measured = 0;
while (measured < FRAMES && g.dev.S === "fight") {
	g.step(1);
	measured++;
}
const n = Math.max(1, t.n - before.n);
const upd = (t.upd - before.upd) / n;
const draw = (t.draw - before.draw) / n;
const mem = process.memoryUsage();

const out = {
	frames: measured,
	updMs: +upd.toFixed(3),
	drawMs: +draw.toFixed(3),
	frameMs: +(upd + draw).toFixed(3),
	fpsCap: Math.round(1000 / Math.max(0.001, upd + draw)),
	heapMB: +(mem.heapUsed / 1048576).toFixed(1),
	screen: g.dev.S,
	errors: g.errors.length,
};
if (asJson) console.log(JSON.stringify(out));
else {
	console.log(`кадров ${out.frames}, экран ${out.screen}`);
	console.log(`  update: ${out.updMs} мс/кадр`);
	console.log(`  draw:   ${out.drawMs} мс/кадр (без растеризации — заглушка canvas)`);
	console.log(`  всего:  ${out.frameMs} мс/кадр, потолок ~${out.fpsCap} FPS по JS`);
	console.log(`  куча:   ${out.heapMB} МБ, ошибок ${out.errors}`);
}
process.exit(0);
