// Сборка «для друзей» (dist/game-public.html): та же игра и ресурсы, вместо редактора — src/runner.js.
// Проверяем состав файла (ничего от редактора: ни кода, ни настроек ИИ, ни пароля) и запуск через
// запускатель как в браузере: хранилище, скрытая кнопка разработчика, сейв, бой.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { boot, ROOT } from "../harness/boot.mjs";
import { createDom } from "../harness/dom.mjs";
import { buildHtml } from "../../tools/lib/assemble.mjs";

const RUNNER = fs.readFileSync(path.join(ROOT, "src/runner.js"), "utf8");
const section = (html, id) => {
	const m = html.match(new RegExp('<script type="text/plain" id="' + id + '">([^]*?)</script>'));
	return m ? m[1] : null;
};

test("сборка без редактора: игра и ресурсы байт в байт те же, редактора, его настроек и пароля нет, файл на ~1,4 МБ легче", () => {
	const full = buildHtml(ROOT),
		pub = buildHtml(ROOT, { public: true });
	for (const id of ["game-assets", "game-src"]) {
		assert.ok(section(full, id), "в полной сборке есть секция " + id);
		assert.equal(section(pub, id), section(full, id), "секция " + id + " совпадает");
	}
	// хвост после секции game-src — запускатель вместо ядра и загрузчика редактора
	const tail = (h) => h.slice(h.indexOf('id="game-src">') + h.slice(h.indexOf('id="game-src">')).indexOf("</script>"));
	assert.ok(tail(pub).includes(RUNNER.trim()), "в публичной сборке стоит src/runner.js");
	assert.ok(tail(pub).length < RUNNER.length + 200, "кроме запускателя и закрывающих тегов в хвосте ничего нет: " + tail(pub).length);
	for (const s of ["MXCore", "AUTH", "f59c238ab9b41fc54ec92368b4bbe15b", "verifyPassword", "api.onekey-ai.lol", "mx_cfg", "data:video/mp4", "window.mxGate=", "indexedDB"]) {
		assert.ok(tail(full).includes(s), "в полной сборке есть «" + s + "» (ориентир проверки)");
		assert.ok(!tail(pub).includes(s), "в публичной сборке нет «" + s + "»");
	}
	// в коде игры секретов редактора тоже нет (соль и хеш пароля живут только в ядре редактора)
	assert.ok(!section(pub, "game-src").includes("f59c238ab9b41fc54ec92368b4bbe15b"));
	assert.ok(full.length - pub.length > 1.3 * 1024 * 1024, "разница в размере: " + ((full.length - pub.length) / 1024 / 1024).toFixed(2) + " МБ");
});

test("запуск через src/runner.js: хранилище браузера, флаг __mxPublic, без mxGate/MXCore; кнопки разработчика в настройках нет; сейв и бой работают", async () => {
	const g = boot({ runner: RUNNER });
	assert.ok(await g.ready());
	g.step(5);
	const st = JSON.parse(g.dev.run("JSON.stringify({ pub: window.__mxPublic, ls: window.__mxStorage === window.localStorage, gate: typeof window.mxGate, core: typeof MXCore, unlocked: typeof window.__mxUnlocked, S })"));
	assert.deepEqual(st, { pub: true, ls: true, gate: "undefined", core: "undefined", unlocked: "undefined", S: "menu" });
	g.dev.labelButtons();
	g.dev.S = "settings";
	g.step(3);
	const labels = g.dev.hits.map((h) => h.label).filter(Boolean);
	assert.ok(labels.includes("Назад"), "настройки нарисованы: " + labels.join(", "));
	assert.ok(!labels.some((l) => /разработ/i.test(l)), "кнопки разработчика нет: " + labels.join(", "));
	// обычная сборка на том же экране кнопку показывает
	const g0 = boot();
	assert.ok(await g0.ready());
	g0.dev.labelButtons();
	g0.dev.S = "settings";
	g0.step(3);
	assert.ok(g0.dev.hits.some((h) => h.label === "Режим разработчика"), "в обычной сборке кнопка есть");
	// сейв уходит в localStorage, загрузка его читает
	g.dev.seed(7);
	g.dev.newGame();
	for (let i = 0; i < 4; i++) g.dev.setSlot(i, g.dev.HEROES[i]);
	g.dev.S = "map";
	g.step(2);
	g.dev.saveGame();
	assert.ok(g.dev.run('window.localStorage.getItem("monsterAwakeningSave")'), "сейв в localStorage");
	assert.ok(g.dev.loadGame(), "загрузка");
	// короткий бой
	g.dev.fight("norm");
	g.dev.autoPlace();
	g.dev.startFight();
	let fr = 0;
	while (fr < 900 && g.dev.run('Machine.is("fight")')) {
		g.step(5);
		fr += 5;
	}
	assert.ok(fr < 900, "бой закончился");
	assert.equal(g.dev.errs().length, 0, JSON.stringify(g.dev.errs()));
});

test("защищённый просмотр: localStorage недоступен — запускатель даёт память вместо него и предупреждает, игра идёт", async () => {
	const dom = createDom();
	const win = dom.windowObj;
	Object.defineProperty(win, "localStorage", {
		get() {
			throw new Error("SecurityError: доступ к хранилищу запрещён");
		},
	});
	const notes = [];
	const append = dom.document.body.appendChild;
	dom.document.body.appendChild = (el) => (el && el.tagName === "DIV" ? notes.push(el.textContent) : append(el));
	const g = boot({ dom, runner: RUNNER });
	assert.ok(await g.ready());
	g.step(3);
	assert.ok(g.dev.run("typeof window.__mxStorage.getItem === 'function' && window.__mxStorage.getItem('x') === null"));
	assert.equal(notes.length, 1, "одно предупреждение");
	assert.match(notes[0], /сохранения временные/);
	g.dev.newGame();
	g.dev.S = "map";
	g.step(2);
	g.dev.saveGame();
	assert.ok(g.readStorage("monsterAwakeningSave"), "сейв лёг в память");
	assert.equal(g.dev.errs().length, 0);
});
