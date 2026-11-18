// Документация не расходится с кодом: схема модулей порождена из исходников, диаграмма состояний
// совпадает с таблицей переходов TRANS.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { analyze, block } from "../../tools/modgraph.mjs";
import { boot } from "../harness/boot.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ARCH = readFileSync(join(ROOT, "docs", "ARCHITECTURE.md"), "utf8");

test("схема модулей в ARCHITECTURE.md совпадает с порождённой из исходников (иначе: npm run docs)", () => {
	const m = ARCH.match(/<!-- modgraph:start[^]*?<!-- modgraph:end -->/);
	assert.ok(m, "в docs/ARCHITECTURE.md нет блока modgraph");
	const fresh = block(analyze());
	assert.equal(m[0], fresh, "схема модулей устарела — выполните `npm run docs` и закоммитьте docs/ARCHITECTURE.md");
});

test("анализатор модулей видит объявления и не путает локальные имена с глобальными", () => {
	const a = analyze();
	const by = Object.fromEntries(a.mods.map((x) => [x.id, x]));
	assert.ok(by["40_fight"].decl > 50 && by["65_screens"].decl > 50, "крупные модули объявляют десятки имён");
	// 40_fight зовёт hurt/anim из себя, но Parts/Timers — из 10_core, а HEROES/KIT — из 20_data
	assert.ok(a.names["40_fight"]["10_core"].includes("Parts"));
	assert.ok(a.names["40_fight"]["20_data"].includes("KIT"));
	// Events.on(ev, fn): параметр ev не считается ссылкой на функцию ev() из 60_game
	assert.ok(!(a.names["10_core"]["60_game"] || []).includes("ev"), "параметр метода принят за глобальное имя");
	// в 70_audio локальный фильтр lp не считается ссылкой на lp(e) из 13_input
	assert.ok(!(a.names["70_audio"]["13_input"] || []).includes("lp"));
});

test("диаграмма состояний в ARCHITECTURE.md совпадает с таблицей переходов TRANS", async () => {
	const g = boot();
	assert.ok(await g.ready());
	const TRANS = JSON.parse(g.dev.run("JSON.stringify(TRANS)"));
	const NAMES = JSON.parse(g.dev.run("JSON.stringify(SCREEN_NAMES)"));
	const dia = ARCH.match(/```mermaid\nstateDiagram-v2\n([^]*?)```/);
	assert.ok(dia, "в docs/ARCHITECTURE.md нет диаграммы stateDiagram-v2");
	const edges = new Set();
	for (const line of dia[1].split("\n")) {
		const m = line.match(/^\s*([\w[\]*]+)\s*-->\s*([\w[\]*]+)/);
		if (m && m[1] !== "[*]" && m[2] !== "[*]") edges.add(m[1] + ">" + m[2]);
	}
	assert.ok(edges.size >= 20, "диаграмма почти пуста: " + edges.size);
	// каждая стрелка диаграммы разрешена таблицей
	for (const e of edges) {
		const [from, to] = e.split(">");
		assert.ok(NAMES.includes(from) && NAMES.includes(to), "неизвестный экран на диаграмме: " + e);
		assert.ok((TRANS[from] || []).includes(to), "диаграмма рисует переход, которого нет в TRANS: " + e);
	}
	// каждый переход таблицы есть на диаграмме, кроме оговорённых в тексте: → menu, → settings, сам в себя, settings → *
	const missing = [];
	for (const [from, tos] of Object.entries(TRANS)) {
		if (from === "settings") continue;
		for (const to of tos) if (to !== "menu" && to !== "settings" && to !== from && !edges.has(from + ">" + to)) missing.push(from + " → " + to);
	}
	assert.deepEqual(missing, [], "в TRANS есть переходы, которых нет на диаграмме");
	// текстовая таблица переходов рядом перечисляет те же экраны-источники
	for (const from of Object.keys(TRANS)) assert.ok(new RegExp("^\\| " + from + "\\b", "m").test(ARCH) || new RegExp("^\\| \\w+, " + from + "\\b", "m").test(ARCH), "в таблице переходов нет строки для " + from);
});
