#!/usr/bin/env node
// Замер «подвисания» при входе в мир (этап M): сколько главный поток занят без возврата в цикл кадра.
// Нарезка запекания карты — как в игре (BAKE_MS = 9). Для каждого мира (1 — newGame, 2…10 — nextWorld):
//   вход     — синхронная часть newGame()/nextWorld(): genMap + заведение bakeMap + перекраска атласа карты;
//   кадр1    — первый кадр со сборкой карты;  худший — самый долгий кадр сборки;  кадров — сколько их было;
//   готов    — первый кадр с готовой картой;
//   fight()  — синхронная часть fight(): mkArena (пол по пикселям) + бойцы;  prep1 — первый кадр расстановки
//              (здесь первая перекраска атласа врагов);  fight1 — первый кадр боя.
// Критерий этапа: ни одна из этих блокировок не дольше 100 мс. Тур повторяется --runs раз (по умолчанию 3),
// в таблице — медиана по каждой клетке, в итоге — худшая клетка по медианам. Код выхода 1, если критерий не выполнен.
//   node tools/entry.mjs [--bake 9] [--runs 3] [--real] [--json]
// Методика:
// • По умолчанию холст — заглушка обвязки (вызовы холста почти бесплатны), то есть меряется JS главного потока —
//   так же, как в npm run perf. В браузере команды 2d-холста с главного потока лишь записываются (~1 мкс на
//   вызов), растеризация идёт отдельно, поэтому JS-время — ближайший аналог блокировки главного потока.
// • --real — настоящий холст @napi-rs/canvas (программная растеризация): цифры выше и годятся для сравнения
//   «до/после», но не для критерия: на этом холсте раз в ~12 кадров случается пауза 100–600 мс внутри одного
//   нативного вызова (fillRect/drawImage/fillText). Она воспроизводится без игры — голым холстом с теми же
//   вызовами (6 drawImage + текст + 300 fillRect на кадр), поэтому к коду игры не относится.
// • Обвязка исполняет игру в vm-контексте Node: обращения к глобальным именам там дороже, чем в браузере;
//   boot.mjs копирует встроенные объекты в константы, но часть накладных расходов остаётся — цифры
//   следует читать как верхнюю границу для ПК; на телефоне JS медленнее в 2–4 раза.
import { createDom } from "../tests/harness/dom.mjs";
import { boot } from "../tests/harness/boot.mjs";

const args = process.argv.slice(2);
const opt = (k, d) => {
	const i = args.indexOf(k);
	return i >= 0 ? args[i + 1] : d;
};
const BAKE = Number(opt("--bake", 9));
const RUNS = Math.max(1, Number(opt("--runs", 3)));
const JSON_OUT = args.includes("--json");
const REAL = args.includes("--real");

let napi = null;
if (REAL) {
	try {
		napi = await import("@napi-rs/canvas");
	} catch (e) {
		console.error("нужен пакет @napi-rs/canvas: npm i -D @napi-rs/canvas");
		process.exit(2);
	}
}
const now = () => Number(process.hrtime.bigint()) / 1e6;
const ms = (v) => (Math.round(v * 10) / 10).toFixed(1);
const COLS = ["enter", "first", "worst", "frames", "ready", "fightSync", "prep1", "fight1"];

// один тур по всем мирам: массив строк {w, id, enter, first, worst, frames, ready, fightSync, prep1, fight1}
async function tour() {
	const dom = napi ? createDom({ dpr: 1, canvasFactory: (w, h) => napi.createCanvas(w, h), ImageClass: napi.Image }) : createDom();
	const g = boot({ dom, bakeMs: BAKE });
	if (!(await g.ready())) throw new Error("игра не загрузилась");
	// время одного кадра цикла (симуляция + порция запекания + отрисовка)
	const frame = () => {
		const t0 = now();
		g.step(1);
		return now() - t0;
	};
	g.step(5);
	g.dev.seed(11);
	const rows = [];
	for (let w = 0; w < g.dev.WORLDS.length; w++) {
		if (w) {
			g.dev.S = "world";
			g.step(2);
		}
		// вход в мир: синхронная часть
		const t0 = now();
		if (w) g.dev.run("nextWorld()");
		else {
			g.dev.newGame();
			for (let i = 0; i < 4; i++) g.dev.setSlot(i, g.dev.HEROES[i]);
			g.dev.S = "map";
		}
		const enter = now() - t0;
		// сборка карты порциями: самый долгий кадр
		let frames = 1,
			first = frame(),
			worst = first;
		while (g.dev.run("!!MAPJ") && frames < 2000) {
			worst = Math.max(worst, frame());
			frames++;
		}
		const ready = frame(); // первый кадр с готовой картой
		// первый бой в мире
		const t1 = now();
		g.dev.fight("norm");
		const fightSync = now() - t1;
		g.dev.autoPlace();
		const prep1 = frame();
		g.dev.startFight();
		const fight1 = frame();
		g.step(10);
		rows.push({ w: w + 1, id: g.dev.WORLDS[w].id, enter, first, worst, frames, ready, fightSync, prep1, fight1 });
		g.dev.S = "map";
		g.step(2);
	}
	if (g.errors.length) {
		console.error("ошибки консоли:", g.errors.slice(0, 5).join("\n"));
		process.exit(1);
	}
	return rows;
}

const runs = [];
for (let r = 0; r < RUNS; r++) runs.push(await tour());
const median = (a) => {
	const s = [...a].sort((x, y) => x - y);
	return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const rows = runs[0].map((row, i) => {
	const out = { w: row.w, id: row.id };
	for (const k of COLS) out[k] = median(runs.map((run) => run[i][k]));
	return out;
});
const block = (r) => Math.max(r.enter, r.first, r.worst, r.ready, r.fightSync, r.prep1, r.fight1);
const worstRow = rows.reduce((a, b) => (block(b) > block(a) ? b : a));
const worstBlock = block(worstRow);
const ok = worstBlock <= 100;
if (JSON_OUT) console.log(JSON.stringify({ bake: BAKE, runs: RUNS, real: REAL, rows, worstBlock: +worstBlock.toFixed(1), worstWorld: worstRow.id, ok }, null, 1));
else {
	console.log(`вход в мир, мс — медиана по ${RUNS} прогон.; нарезка ${BAKE} мс; ${REAL ? "настоящий холст (программная растеризация, см. оговорку в заголовке файла)" : "JS главного потока, холст-заглушка"}; ПК — верхняя граница, телефон медленнее в 2–4 раза`);
	console.log("мир          вход  кадр1  худший  кадров  готов  fight()  prep1  fight1");
	for (const r of rows) console.log(`${String(r.w).padStart(2)} ${r.id.padEnd(8)} ${ms(r.enter).padStart(6)} ${ms(r.first).padStart(6)} ${ms(r.worst).padStart(7)} ${String(Math.round(r.frames)).padStart(7)} ${ms(r.ready).padStart(6)} ${ms(r.fightSync).padStart(8)} ${ms(r.prep1).padStart(6)} ${ms(r.fight1).padStart(7)}`);
	console.log(`худшая блокировка главного потока: ${ms(worstBlock)} мс (${worstRow.id}) — критерий ≤ 100 мс ${ok ? "выполнен" : "НЕ выполнен"}`);
}
process.exit(ok ? 0 : 1);
