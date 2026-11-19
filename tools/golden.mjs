#!/usr/bin/env node
// Golden master: эталонное поведение боя и генерации карты.
//   node tools/golden.mjs --record            — записать эталон в tests/golden/
//   node tools/golden.mjs --check             — сравнить текущий код с эталоном
//   node tools/golden.mjs --record --battles 20 --maps 50   — быстрый прогон
//   node tools/golden.mjs --check --battles 60 --maps 150   — быстрая проверка ПРЕФИКСА эталона (npm run golden:quick):
//   node tools/golden.mjs --check --html dist/game-public.html   — код игры брать из готового HTML (обе сборки через эталон)
//     сиды идут подряд, поэтому первые N записей сравнимы с полным эталоном; ворота этапа — только полный прогон
// Эталон — это не «правильные» числа, а зафиксированное поведение: любое расхождение
// означает, что рефакторинг изменил игру. Осознанное изменение баланса фиксируется
// перезаписью эталона и записью в docs/BALANCE.md.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { boot, ROOT } from "../tests/harness/boot.mjs";
import { codeFromHtml } from "./lib/assemble.mjs";

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const HTML = args.includes("--html") ? args[args.indexOf("--html") + 1] : null;
const val = (f, d) => {
	const i = args.indexOf(f);
	return i >= 0 && args[i + 1] ? Number(args[i + 1]) : d;
};
const record = has("--record");
const check = has("--check") || !record;
if (record && has("--v2")) throw new Error("нельзя записывать эталон с --v2");
const NB = val("--battles", 500);
const NM = val("--maps", 1000);
const GDIR = path.join(ROOT, "tests/golden");
const hash = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);

const KINDS = ["fight", "fight", "boss", "arena", "swamp"];

async function main() {
	const g = boot(HTML ? { code: codeFromHtml(path.resolve(HTML)) } : {});
	if (!(await g.ready())) throw new Error("игра не загрузилась");
	if (has("--v2")) g.dev.run("V2 = true");

	/* ---------- бои ---------- */
	// newGame() пересобирает картинку карты (~0.9 c), поэтому состояние готовим один раз,
	// а перед каждым боем пересеиваем генератор — на исход это не влияет.
	g.dev.seed(424242);
	g.dev.newGame();
	const battles = [];
	for (let i = 0; i < NB; i++) {
		const seed = 1000 + i * 7;
		g.dev.seed(seed);
		const party = 1 + (i % 5);
		for (let k = 0; k < 8; k++) g.dev.setSlot(k, null);
		for (let k = 0; k < party; k++) g.dev.setSlot(k, g.dev.HEROES[(i * 3 + k) % g.dev.HEROES.length]);
		const w = i % 10,
			depth = (i * 5) % 12,
			kind = KINDS[i % KINDS.length];
		g.dev.setWorld(w, depth);
		// предыдущий бой обрывается на F.out, экран ещё «fight»: таблица переходов запрещает
		// fight → prep, поэтому, как и сама игра, сначала возвращаемся в меню (на Rand не влияет)
		g.dev.S = "menu";
		g.dev.fight(kind);
		g.dev.startFight();
		// крутим кадры до развязки: F.out появляется за полсекунды до смены экрана,
		// поэтому статистику боя успеваем снять, пока F ещё жив
		let frames = 0,
			out = "none";
		while (frames < 5000) {
			g.step(1);
			frames++;
			const F0 = g.dev.F;
			if (F0 && F0.out) {
				out = F0.out.win ? "win" : "lose";
				break;
			}
			if (g.dev.S !== "fight") {
				out = "left:" + g.dev.S;
				break;
			}
		}
		const F = g.dev.F;
		const st = F && F.st ? F.st : { dmg: 0, taken: 0, kills: 0, crits: 0 };
		battles.push({
			i,
			seed,
			kind,
			w,
			depth,
			party,
			result: out,
			frames,
			st: { dmg: Math.round(st.dmg), taken: Math.round(st.taken), kills: st.kills, crits: st.crits },
			rand: g.dev.randState,
			hash: hash(g.dev.snapshot() + "|" + out),
		});
		if (g.fatal) throw new Error("ошибка в бою " + i + ": " + g.fatal);
	}

	/* ---------- карта ---------- */
	const maps = [];
	for (let i = 0; i < NM; i++) {
		const seed = 5000 + i * 13;
		g.dev.seed(seed);
		g.dev.genMap(); // только граф; картинку карты (bakeMap) не трогаем — это дорого и к графу не относится
		const N = g.dev.N || [];
		const E = g.dev.E || [];
		maps.push({
			seed,
			nodes: N.length,
			edges: E.length,
			rand: g.dev.randState,
			hash: hash(JSON.stringify(N.map((n) => [Math.round(n.x), Math.round(n.y), n.k || "", n.ly])) + "|" + JSON.stringify(E)),
		});
	}

	const battlesSummary = hash(battles.map((b) => b.hash).join(","));
	const mapsSummary = hash(maps.map((m) => m.hash).join(","));
	const payload = {
		version: 1,
		generatedBy: "tools/golden.mjs",
		battles: { count: battles.length, summary: battlesSummary, items: battles },
		maps: { count: maps.length, summary: mapsSummary, items: maps },
	};

	if (g.errors.length) console.log("предупреждения игры:", g.errors.slice(0, 5));

	if (record) {
		fs.mkdirSync(GDIR, { recursive: true });
		fs.writeFileSync(path.join(GDIR, "golden.json"), JSON.stringify(payload, null, 1) + "\n");
		console.log(`эталон записан: боёв ${battles.length} (${battlesSummary}), карт ${maps.length} (${mapsSummary})`);
		const wins = battles.filter((b) => b.result === "win").length;
		console.log(`  исходы: побед ${wins}, поражений ${battles.length - wins}, среднее кадров ${Math.round(battles.reduce((s, b) => s + b.frames, 0) / battles.length)}`);
		return 0;
	}

	const file = path.join(GDIR, "golden.json");
	if (!fs.existsSync(file)) {
		console.error("нет эталона tests/golden/golden.json — сначала node tools/golden.mjs --record");
		return 2;
	}
	const ref = JSON.parse(fs.readFileSync(file, "utf8"));
	if (ref.battles.count < battles.length || ref.maps.count < maps.length) {
		console.error(`набор больше эталона: боёв ${battles.length}/${ref.battles.count}, карт ${maps.length}/${ref.maps.count} — уменьшите --battles/--maps или перезапишите эталон`);
		return 2;
	}
	const subset = ref.battles.count !== battles.length || ref.maps.count !== maps.length;
	if (subset) console.log(`ВНИМАНИЕ: проверяется префикс эталона (боёв ${battles.length} из ${ref.battles.count}, карт ${maps.length} из ${ref.maps.count}); ворота этапа — полный прогон npm run golden`);
	let bad = 0;
	for (let i = 0; i < battles.length; i++) {
		if (ref.battles.items[i].hash !== battles[i].hash) {
			if (bad < 5) {
				const a = ref.battles.items[i],
					b = battles[i];
				console.error(`бой #${i} (seed ${b.seed}, ${b.kind}, мир ${b.w}): эталон ${a.hash}, сейчас ${b.hash}`);
				console.error(`   эталон: ${a.result} за ${a.frames} кадров, st ${JSON.stringify(a.st)}`);
				console.error(`   сейчас: ${b.result} за ${b.frames} кадров, st ${JSON.stringify(b.st)}`);
			}
			bad++;
		}
	}
	let badM = 0;
	for (let i = 0; i < maps.length; i++) {
		if (ref.maps.items[i].hash !== maps[i].hash) {
			if (badM < 3) console.error(`карта #${i} (seed ${maps[i].seed}) не совпала`);
			badM++;
		}
	}
	console.log(`бои: совпало ${battles.length - bad} из ${battles.length} (${battlesSummary})`);
	console.log(`карты: совпало ${maps.length - badM} из ${maps.length} (${mapsSummary})`);
	return bad || badM ? 1 : 0;
}

main()
	.then((code) => process.exit(code))
	.catch((e) => {
		console.error("FAIL:", e && e.stack ? e.stack.split("\n").slice(0, 6).join("\n") : e);
		process.exit(1);
	});
