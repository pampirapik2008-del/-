// ИИ-редактор: ядро (патчи, синтаксис, ошибки API, маскирование, версии, наблюдатель песочницы)
// и загрузчик (автооткат, наблюдение за журналом игры) в заглушке браузера.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { createDom } from "../harness/dom.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CORE_SRC = fs.readFileSync(path.join(ROOT, "src/editor/core.js"), "utf8");
const LOADER_SRC = fs.readFileSync(path.join(ROOT, "src/editor/loader.js"), "utf8");
const MXCore = new Function(CORE_SRC + "\nreturn MXCore;")();

test("патчи: разбор формата и атомарное применение", () => {
	const code = "function a() {\n\treturn 1;\n}\nfunction b() {\n\treturn 2;\n}\n";
	const ans = "Поправил.\n@@@FIND\nfunction a() {\n\treturn 1;\n@@@REPLACE\nfunction a() {\n\treturn 10;\n@@@END\n";
	const P = MXCore.parsePatches(ans);
	assert.equal(P.length, 1);
	const ok = MXCore.applyPatches(code, P);
	assert.deepEqual(ok.bad, []);
	assert.match(ok.out, /return 10;/);
	// «старое» не найдено — код не меняется, причина понятна
	const miss = MXCore.applyPatches(code, [{ f: "return 7;", r: "return 8;" }]);
	assert.equal(miss.out, code);
	assert.match(miss.bad[0], /не найден/);
	// «старое» встречается дважды — отказ, и первый удачный патч тоже откатывается (атомарность)
	const twice = MXCore.applyPatches(code, [
		{ f: "function a() {", r: "function a() { // x" },
		{ f: "\treturn", r: "\treturn /*y*/" },
	]);
	assert.equal(twice.out, code, "ни одна замена не легла");
	assert.match(twice.bad[0], /2 раза/);
	assert.equal(twice.bad.length, 1);
	assert.match(MXCore.applyPatches(code, [{ f: "", r: "x" }]).bad[0], /пустой/);
	// ограждение ```js снимается
	assert.equal(MXCore.parsePatches("@@@FIND\n```js\nfoo\n```\n@@@REPLACE\n```js\nbar\n```\n@@@END")[0].f, "foo");
});

test("проверка синтаксиса и хеш версии", () => {
	assert.equal(MXCore.checkSyntax("const a = 1;").ok, true);
	const bad = MXCore.checkSyntax("const a = ;");
	assert.equal(bad.ok, false);
	assert.ok(bad.error.length > 0);
	assert.equal(MXCore.hash("abc"), MXCore.hash("abc"));
	assert.notEqual(MXCore.hash("abc"), MXCore.hash("abd"));
	assert.match(MXCore.hash(""), /^[0-9a-f]{8}$/);
});

test("ошибки API переводятся на человеческий язык", () => {
	const e = MXCore.apiError;
	assert.match(e({ error: new TypeError("Failed to fetch") }), /Нет сети/);
	assert.match(e({ status: 401, body: "unauthorized" }), /ключ/);
	assert.match(e({ status: 403 }), /ключ/);
	assert.match(e({ status: 429 }), /лимит|квота/i);
	assert.match(e({ status: 402 }), /средства/);
	assert.match(e({ status: 503 }), /временно недоступен/);
	assert.match(e({ status: 404 }), /Base URL/);
	assert.match(e({ timeout: true }), /не ответила/);
	assert.match(e({ error: { name: "AbortError", message: "aborted" } }), /не ответила/);
	assert.match(e({ truncated: true }), /оборван/);
	assert.match(e({ tooLarge: true, size: 5e6 }), /слишком большой/);
	assert.match(e({ badJson: true }), /не JSON/);
	assert.match(e({ empty: true }), /Пустой ответ/);
	assert.match(e({ status: 400, body: "model not found" }), /400.*model not found/);
	// обрыв ответа в обоих форматах
	assert.equal(MXCore.isTruncated({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }), true);
	assert.equal(MXCore.isTruncated({ choices: [{ finish_reason: "length" }] }), true);
	assert.equal(MXCore.isTruncated({ choices: [{ finish_reason: "stop" }] }), false);
	assert.equal(MXCore.isTruncated(null), false);
});

test("ключ API не попадает в тексты", () => {
	const key = "sk-abcdef1234567890";
	const m = MXCore.maskSecrets("Authorization: Bearer " + key + " key=\"" + key + "\" plain " + key, key);
	assert.ok(!m.includes(key), m);
	// без известного ключа срабатывают шаблоны: sk-…, Bearer …, key="…"
	const m1 = MXCore.maskSecrets("Bearer " + key + " и key=\"" + key + "\"");
	assert.ok(!m1.includes(key), m1);
	assert.match(m1, /sk-\*\*\*/);
	assert.match(MXCore.maskSecrets("Authorization: Bearer QWERTYUIOPASDFGH"), /Bearer \*\*\*/);
	// произвольный ключ без префикса sk- маскируется по значению
	const m2 = MXCore.maskSecrets("ошибка: token XYZSECRET987 отклонён", "XYZSECRET987");
	assert.ok(!m2.includes("XYZSECRET987"));
	assert.match(m2, /XYZ…87/);
	assert.equal(MXCore.maskSecrets(null), "");
});

test("удаление старых версий: 15 новейших, good и active неприкосновенны", () => {
	const versions = [];
	for (let i = 1; i <= 20; i++) versions.push({ id: i });
	const del = MXCore.pruneList(versions, "2", "3", 15);
	assert.deepEqual(del, [5, 4, 1], "удаляются старые, кроме good=2 и active=3");
	assert.deepEqual(MXCore.pruneList(versions.slice(0, 10), "1", "2", 15), []);
});

// наблюдатель песочницы: запускаем его в отдельном контексте с «игрой» из нескольких глобалов
function runTrial(ms, game, onCtx) {
	return new Promise((resolve) => {
		const ctx = {
			Date,
			setInterval,
			clearInterval,
			String,
			Object,
			Math,
			addEventListener() {},
			parent: { postMessage: (m) => resolve(m) },
		};
		Object.assign(ctx, game);
		vm.createContext(ctx);
		if (onCtx) onCtx(ctx);
		vm.runInContext(MXCore.trialScript(ms), ctx);
	});
}
test("наблюдатель песочницы: живая игра проходит, ошибка в журнале — нет", async () => {
	assert.equal(MXCore.checkSyntax(MXCore.trialScript(2500)).ok, true, "скрипт наблюдателя синтаксически верен");
	let tick = null;
	const ok = await runTrial(600, { READY: true, FRAME_N: 0, S: "menu", ERRS: [] }, (ctx) => {
		tick = setInterval(() => ctx.FRAME_N++, 20); // «цикл кадра» живой игры
	});
	clearInterval(tick);
	assert.equal(ok.ok, true, JSON.stringify(ok));
	assert.ok(ok.state.frame > 5);
	const err = await runTrial(600, { READY: true, FRAME_N: 1, S: "menu", ERRS: [{ kind: "draw", msg: "x is not defined" }] });
	assert.equal(err.ok, false);
	assert.match(err.why, /draw: x is not defined/);
	const stuck = await runTrial(300, { READY: true, FRAME_N: 1, S: "menu", ERRS: [] });
	assert.equal(stuck.ok, false);
	assert.match(stuck.why, /цикл кадра/);
});

// ---------- загрузчик в заглушке браузера ----------
// Фальшивая IndexedDB: хранит версии в Map, запросы завершаются асинхронно.
function fakeIDB(initial) {
	const rows = new Map((initial || []).map((v) => [v.id, v]));
	const req = (val) => {
		const r = { result: val };
		return r;
	};
	return {
		open() {
			const r = {};
			setImmediate(() => {
				r.result = {
					createObjectStore() {},
					transaction() {
						const t = {};
						t.objectStore = () => ({
							get: (id) => req(rows.get(id)),
							put: (v) => (rows.set(v.id, v), req(v.id)),
							delete: (id) => (rows.delete(id), req(undefined)),
							getAll: () => req([...rows.values()]),
						});
						setImmediate(() => t.oncomplete && t.oncomplete());
						return t;
					},
				};
				r.onupgradeneeded && r.onupgradeneeded();
				r.onsuccess && r.onsuccess();
			});
			return r;
		},
		rows,
	};
}
function loadLoader(opts) {
	opts = opts || {};
	const dom = createDom();
	const win = dom.windowObj;
	const timers = []; // ручные таймеры: тест сам двигает время
	// крошечный реестр элементов по id: innerHTML с id="…" рождает дочерние заглушки, querySelector('#id') их находит,
	// remove() снимает регистрацию — этого хватает, чтобы прогнать окно пароля настоящими обработчиками
	const byId = new Map();
	const patchEl = (el) => {
		const cls = new Set();
		let html = "", id = "";
		const kids = [];
		Object.assign(el, {
			append() {},
			insertBefore() {},
			click() {},
			pause() {},
			play: () => Promise.resolve(),
			closest: () => null,
			setPointerCapture() {},
			releasePointerCapture() {},
			remove() { byId.delete(id); for (const k of kids) byId.delete(k); },
			querySelector: (sel) => (sel[0] === "#" && byId.get(sel.slice(1))) || null,
			classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), toggle: (c, f) => (f === undefined ? (cls.has(c) ? cls.delete(c) : cls.add(c)) : f ? cls.add(c) : cls.delete(c)), contains: (c) => cls.has(c) },
		});
		Object.defineProperty(el, "id", { get: () => id, set: (v) => { id = String(v); byId.set(id, el); } });
		Object.defineProperty(el, "innerHTML", {
			get: () => html,
			set: (v) => {
				html = String(v);
				for (const m of html.matchAll(/<(\w+)[^>]*?\sid="([^"]+)"/g)) {
					const k = patchEl(mk(m[1]));
					k.value = ""; k.textContent = ""; k.disabled = false; k.id = m[2]; kids.push(m[2]);
				}
			},
		});
		return el;
	};
	const mk = dom.document.createElement;
	dom.document.createElement = (tag) => patchEl(mk(tag));
	dom.document.head = patchEl(mk("head"));
	patchEl(dom.document.body);
	dom.document.getElementById = (i) => byId.get(i) || null;
	dom.document.querySelector = (sel) => byId.get(sel.slice(1)) || patchEl(Object.assign(mk("div"), { textContent: sel === "#game-src" ? "/*game*/" : sel === "#game-assets" ? "/*assets*/" : "" }));
	const warns = [];
	const reloads = [];
	Object.assign(win, {
		console: { log() {}, warn: (...a) => warns.push(a.join(" ")), error: (...a) => warns.push(a.join(" ")) },
		indexedDB: fakeIDB(opts.versions),
		setTimeout: (f, ms) => (timers.push({ f, at: ms | 0, kind: "t" }), timers.length),
		clearTimeout: (id) => id && timers[id - 1] && (timers[id - 1].dead = true),
		setInterval: (f, ms) => (timers.push({ f, at: ms | 0, every: ms | 0, kind: "i" }), timers.length),
		clearInterval: (id) => id && timers[id - 1] && (timers[id - 1].dead = true),
		location: { hash: opts.hash || "", href: "http://localhost/", reload: () => reloads.push(1) },
		AbortController: class { constructor() { this.signal = {}; } abort() {} },
		Date,
		JSON,
		Math,
		Promise,
		Map,
		Set,
		Object,
		Array,
		String,
		Number,
		RegExp,
		Error,
		TypeError,
		Function,
		setImmediate,
		crypto: globalThis.crypto,
		TextEncoder,
		Uint8Array,
	});
	for (const [k, v] of Object.entries(opts.ls || {})) win.localStorage.setItem(k, v);
	if (opts.game) Object.assign(win, opts.game);
	vm.createContext(win);
	vm.runInContext(CORE_SRC, win, { filename: "core.js" });
	if (opts.auth) win.MXCore.AUTH = opts.auth; // тестовая пара соль/хеш вместо боевой
	vm.runInContext(LOADER_SRC, win, { filename: "loader.js" });
	// прокрутить ручные таймеры до момента ms (интервалы срабатывают кратно периоду)
	const advance = async (ms) => {
		for (let now = 0; now <= ms; now += 250) {
			for (const t of timers.slice()) {
				if (t.dead) continue;
				if (t.kind === "t" && t.at <= now) {
					t.dead = true;
					t.f();
				} else if (t.kind === "i" && now > 0 && now % Math.max(250, t.every) === 0) t.f();
			}
			await new Promise((r) => setImmediate(r));
		}
	};
	const settle = async () => {
		for (let i = 0; i < 12; i++) await new Promise((r) => setImmediate(r));
	};
	return { win, ls: win.localStorage, warns, reloads, advance, settle, winListeners: dom.winListeners, byId };
}
// тестовая пара «пароль → соль/хеш» (боевой пароль в тестах не фигурирует: проверяется та же функция на своей паре)
const TEST_PWD = "тестовый пароль редактора 42";
let TEST_AUTH = null;
async function testAuth() {
	if (!TEST_AUTH) {
		TEST_AUTH = { salt: "соль-для-тестов", iter: 2000, hash: "" };
		TEST_AUTH.hash = await MXCore.pwdHash(TEST_PWD, TEST_AUTH);
	}
	return TEST_AUTH;
}
// ввести пароль в окно загрузчика (настоящие обработчики DOM-заглушки)
async function enterPassword(L, pwd) {
	const inp = L.byId.get("mx-dev-in");
	assert.ok(inp, "окно пароля открыто");
	inp.value = pwd;
	inp.onkeydown({ key: "Enter", stopPropagation() {} });
	// PBKDF2 считается в пуле потоков — ждём настоящим временем, а не микрозадачами
	for (let i = 0; i < 400 && L.byId.get("mx-dev-err") && L.byId.get("mx-dev-err").textContent === "Проверяю…"; i++) await new Promise((r) => setTimeout(r, 5));
	await L.settle();
}

test("загрузчик: интерфейс и запуск оригинала без ошибок, панель открывается аварийным жестом", async () => {
	const L = loadLoader();
	await L.settle();
	assert.deepEqual(L.warns, [], "ни предупреждений интерфейса, ни ошибок запуска");
	assert.equal(typeof L.win.MXCore, "object");
	assert.equal(typeof L.win.mxUnlock, "function");
	assert.equal(L.ls.getItem("mx_dev"), null);
	// 5 касаний левого верхнего угла — окно пароля доступно даже при сломанной игре, но панель без пароля не открывается
	const taps = L.winListeners.pointerdown || [];
	assert.ok(taps.length >= 1, "есть обработчик аварийного жеста");
	for (let i = 0; i < 5; i++) taps.forEach((f) => f({ clientX: 10, clientY: 10 }));
	assert.ok(L.byId.get("mx-dev-ov"), "жест открывает окно пароля");
	assert.notEqual(L.win.__mxOpen, true, "панель закрыта");
	assert.equal(L.ls.getItem("mx_dev"), null, "в хранилище ничего не пишется");
});

test("пароль редактора: PBKDF2-SHA-256 с солью — верный подходит, неверный нет; в коде только соль и хеш", async () => {
	const a = await testAuth();
	assert.match(a.hash, /^[0-9a-f]{64}$/);
	assert.equal(await MXCore.verifyPassword(TEST_PWD, a), true);
	assert.equal(await MXCore.verifyPassword(TEST_PWD + " ", a), false);
	assert.equal(await MXCore.verifyPassword("", a), false);
	assert.equal(await MXCore.verifyPassword("676767", a), false);
	assert.equal(await MXCore.verifyPassword(TEST_PWD, { ...a, salt: "другая соль" }), false, "соль входит в хеш");
	// сравнение без раннего выхода
	assert.equal(MXCore.hexEq("abcd", "abcd"), true);
	assert.equal(MXCore.hexEq("abcd", "abce"), false);
	assert.equal(MXCore.hexEq("abcd", "abc"), false);
	assert.equal(MXCore.hexEq("", ""), true);
	// боевые константы: хеш правильной формы, не заглушка, соль задана, раундов не меньше 100 000
	const A = MXCore.AUTH;
	assert.match(A.hash, /^[0-9a-f]{64}$/);
	assert.notEqual(A.hash, "0".repeat(64), "хеш заполнен");
	assert.ok(A.salt.length >= 16);
	assert.ok(A.iter >= 100000);
	assert.notEqual(await MXCore.verifyPassword(TEST_PWD), true, "тестовый пароль боевому хешу не подходит");
	// без WebCrypto — понятная ошибка, а не «тихий» отказ
	await assert.rejects(MXCore.pwdHash("x", a, null), /WebCrypto/);
	// старой схемы (FNV-1a с солью в коде игры) больше нет ни в коде, ни в сборках
	const files = ["index.html", "dist/game.html", "src/game/65_screens.js", "src/editor/loader.js"].filter((f) => fs.existsSync(path.join(ROOT, f)));
	for (const f of files) {
		const t = fs.readFileSync(path.join(ROOT, f), "utf8");
		assert.ok(!t.includes("mxdev2026") && !t.includes("_mxh("), f + ": старая проверка пароля удалена");
		assert.ok(!t.includes("mx_dev\", \"1\"") && !t.includes("setItem('mx_dev'"), f + ": доступ не сохраняется в хранилище");
	}
});

// настоящий пароль не хранится в репозитории: проверка с ним выполняется только локально, если он передан через переменную окружения
test("настоящий пароль подходит и не лежит в исходниках/сборках (нужен MX_EDITOR_PASSWORD)", { skip: !process.env.MX_EDITOR_PASSWORD && "нет MX_EDITOR_PASSWORD" }, async () => {
	const pwd = process.env.MX_EDITOR_PASSWORD;
	assert.equal(await MXCore.verifyPassword(pwd), true);
	assert.equal(await MXCore.verifyPassword(pwd + "1"), false);
	const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (["node_modules", ".git", ".cache"].includes(e.name) ? [] : walk(path.join(d, e.name))) : [path.join(d, e.name)]));
	const leaks = walk(ROOT).filter((f) => /\.(js|mjs|html|md|json|txt)$/.test(f) && fs.readFileSync(f, "utf8").includes(pwd));
	assert.deepEqual(leaks, [], "открытого пароля нет ни в одном файле репозитория");
});

test("вход в редактор: верный пароль открывает панель, неверный — нет, после перезагрузки снова закрыто", async () => {
	const auth = await testAuth();
	const L = loadLoader({ auth });
	await L.settle();
	assert.equal(L.win.__mxUnlocked, false);
	assert.equal(typeof L.win.mxGate, "function");
	// кнопка «AI» скрыта, пока пароль не введён
	const btn = [...L.byId.values()].find((e) => e.id === "mx-b");
	assert.ok(btn, "кнопка панели создана");
	assert.equal(btn.style.display, "none");
	// неверный пароль
	L.win.mxGate(true);
	assert.ok(L.byId.get("mx-dev-ov"), "окно пароля");
	await enterPassword(L, "неверный пароль 123");
	assert.equal(L.byId.get("mx-dev-err").textContent, "Неверный пароль");
	assert.equal(L.win.__mxUnlocked, false);
	assert.notEqual(L.win.__mxOpen, true);
	assert.ok(L.byId.get("mx-dev-ov"), "окно осталось открытым для новой попытки");
	// верный пароль
	await enterPassword(L, TEST_PWD);
	assert.equal(L.win.__mxUnlocked, true);
	assert.equal(L.byId.get("mx-dev-ov"), undefined, "окно закрылось");
	assert.equal(btn.style.display, "block");
	assert.equal(L.win.__mxOpen, true, "панель открыта");
	assert.equal(L.ls.getItem("mx_dev"), null, "в хранилище доступ не записан");
	// повторный вызов при открытом доступе окно не показывает
	L.win.mxGate();
	assert.equal(L.byId.get("mx-dev-ov"), undefined);
	// «перезагрузка»: тот же localStorage, новый загрузчик — снова закрыто
	const keep = {};
	for (const k of ["mx_cfg", "mx_pos", "mx_active", "mx_good"]) if (L.ls.getItem(k) != null) keep[k] = L.ls.getItem(k);
	const R = loadLoader({ auth, ls: keep });
	await R.settle();
	assert.equal(R.win.__mxUnlocked, false);
	assert.equal([...R.byId.values()].find((e) => e.id === "mx-b").style.display, "none");
	R.win.mxUnlock(true);
	assert.ok(R.byId.get("mx-dev-ov"), "после перезагрузки снова спрашивает пароль");
	assert.notEqual(R.win.__mxOpen, true);
	assert.deepEqual(R.warns, []);
});

test("загрузчик: незавершённый прошлый запуск откатывается на good с пометкой «не запустилась»", async () => {
	const L = loadLoader({ ls: { mx_pending: "777", mx_active: "777", mx_good: "orig" } });
	await L.settle();
	assert.equal(L.ls.getItem("mx_active"), "orig");
	assert.equal(L.ls.getItem("mx_pending"), null);
	assert.deepEqual(JSON.parse(L.ls.getItem("mx_bad")), ["777"]);
	assert.deepEqual(L.warns, []);
});

test("загрузчик: новая версия становится good после 6 с без сбоев, а сбой кадра в журнале игры откатывает её", async () => {
	const v = { id: 900, ts: 900, seq: 1, note: "тест", code: "/*v900*/", good: false };
	// успех: журнал игры пуст все 6 секунд
	const A = loadLoader({ versions: [v], ls: { mx_active: "900", mx_good: "orig" }, game: { ERRS: [] } });
	await A.settle();
	assert.equal(A.ls.getItem("mx_pending"), "900", "наблюдение началось");
	await A.advance(6000);
	await A.settle();
	assert.equal(A.ls.getItem("mx_good"), "900");
	assert.equal(A.ls.getItem("mx_pending"), null);
	assert.equal(A.reloads.length, 0);
	assert.equal(A.win.indexedDB.rows.get(900).good, true, "версия помечена good и в базе");
	// сбой: игра пишет ошибку кадра в журнал — без исключения окна
	const B = loadLoader({ versions: [v], ls: { mx_active: "900", mx_good: "orig" }, game: { ERRS: [] } });
	await B.settle();
	B.win.ERRS.push({ kind: "draw", msg: "boom sk-abcdef123456" });
	await B.advance(1000);
	await B.settle();
	assert.equal(B.ls.getItem("mx_active"), "orig", "откат на good");
	assert.equal(B.reloads.length, 1, "перезапуск");
	assert.deepEqual(JSON.parse(B.ls.getItem("mx_bad")), ["900"]);
	const note = B.ls.getItem("mx_notice") || "";
	assert.match(note, /сбои в игре/);
	assert.ok(!note.includes("sk-abcdef123456"), "ключ в уведомлении замаскирован");
	// «предупреждения» вроде loadGame не считаются сбоем версии
	const C = loadLoader({ versions: [v], ls: { mx_active: "900", mx_good: "orig" }, game: { ERRS: [{ kind: "loadGame", msg: "сохранение не прочитано" }] } });
	await C.settle();
	await C.advance(6000);
	await C.settle();
	assert.equal(C.ls.getItem("mx_good"), "900");
});
