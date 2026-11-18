#!/usr/bin/env node
// Тур по игре в настоящем Chromium — дополнение к tools/e2e.mjs, которому недоступны события
// браузера. Здесь проверяется то, что заглушка DOM в tests/harness подделать не может:
//   • клики мышью и тачем, пересчитанные через письмо-коробку fit() и CSS-поворот в портрете;
//   • клавиатура (пробел — расстановка/бой, Escape — пауза) и настоящий requestAnimationFrame;
//   • DOM-окна поверх канваса: экспорт сохранения (Blob + скачивание), вход в редактор (WebCrypto);
//   • изменение размера окна на лету; публичная сборка dist/game-public.html (без редактора).
// Браузер — puppeteer-core + @sparticuz/chromium, ставятся по требованию (см. tools/lib/browser.mjs):
//   npm run browser:setup                        — один раз, ~64 МБ, в package.json не входят
//   npm run browser:tour                         — все проходы: desktop, mobile, public, editor
//   node tools/browser-tour.mjs --only desktop,mobile --out /tmp/shots --html dist/game.html
//   MX_EDITOR_PASSWORD=… node tools/browser-tour.mjs --only editor   — ещё и вход верным паролем
// Любая ошибка шага, консоли или ERRS игры = код выхода 1. Снимки — в каталоге --out.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launch } from "./lib/browser.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const HTML = path.resolve(ROOT, opt("--html", "index.html"));
const PUBLIC = path.resolve(ROOT, opt("--public", "dist/game-public.html"));
const OUT = opt("--out", fs.mkdtempSync(path.join(os.tmpdir(), "browser-tour-")));
const ONLY = opt("--only", "desktop,mobile,public,editor").split(",");
const SEED = 777;
const DEVAPI = fs.readFileSync(path.join(ROOT, "tests/harness/devapi.js"), "utf8");
fs.mkdirSync(OUT, { recursive: true });

const report = [];
const fail = (what, why) => {
	const e = new Error(what + (why ? ": " + why : ""));
	e.step = what;
	throw e;
};
const ok = (cond, what, why) => (cond ? report.push("  ✓ " + what) : fail(what, why));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Одна вкладка с игрой: клики в игровых координатах (1218×540), ожидания, снимки, сбор ошибок.
class Game {
	constructor(page, { touch = false, tag = "" } = {}) {
		this.page = page;
		this.touch = touch;
		this.tag = tag;
		this.console = [];
		page.on("pageerror", (e) => this.console.push("pageerror: " + (e && e.message)));
		page.on("console", (m) => (m.type() === "error" ? this.console.push("console.error: " + m.text()) : 0));
		page.on("requestfailed", (r) => this.console.push("request failed: " + r.url()));
	}
	async open(file) {
		await this.page.goto(pathToFileURL(file).href, { waitUntil: "load" });
		await this.until("typeof READY !== 'undefined' && READY === true", 30000, "игра не загрузилась");
		await this.page.addScriptTag({ content: DEVAPI }); // tests/harness/devapi.js — тот же отладочный API, что в тестах
		await this.ev("__dev.labelButtons()");
	}
	ev(code, ...a) {
		return this.page.evaluate(code, ...a);
	}
	async until(code, ms = 10000, what) {
		try {
			await this.page.waitForFunction(code, { timeout: ms, polling: "raf" });
		} catch (e) {
			fail(what || "не дождались: " + code, "экран " + (await this.S()) + "; " + e.message.split("\n")[0]);
		}
	}
	S() {
		return this.ev("__dev.S");
	}
	// игровые координаты → координаты страницы: обратное к lp() из 13_input.js (письмо-коробка + поворот)
	pos(gx, gy) {
		return this.ev(
			([gx, gy]) => {
				const w = innerWidth,
					h = innerHeight,
					po = h > w,
					bw = po ? h : w,
					bh = po ? w : h,
					s = Math.min(bw / W, bh / H),
					lx = (bw - W * s) / 2 + gx * s,
					ly = (bh - H * s) / 2 + gy * s;
				return po ? [w - ly, lx] : [lx, ly];
			},
			[gx, gy],
		);
	}
	async tap(gx, gy) {
		const [x, y] = await this.pos(gx, gy);
		if (this.touch) await this.page.touchscreen.tap(x, y);
		else await this.page.mouse.click(x, y);
	}
	// кнопка по подписи; первые кадры нового экрана могут идти без целей касания (переход) — ждём до 2 с
	async hit(label, ms = 2000) {
		try {
			const h = await this.page.waitForFunction(
				(l) => {
					const h = __dev.findHit(l);
					return h ? JSON.stringify({ x: h.x, y: h.y, w: h.w, h: h.h }) : false;
				},
				{ timeout: ms, polling: "raf" },
				label,
			);
			return JSON.parse(await h.jsonValue());
		} catch (_) {
			return null;
		}
	}
	async labels() {
		return this.ev("(__dev.hits || []).map((h) => h.label || '?')");
	}
	async click(label) {
		const h = await this.hit(label);
		if (!h) fail("кнопка «" + label + "»", "нет на экране " + (await this.S()) + " (есть: " + (await this.labels()).join(", ") + ")");
		await this.tap(h.x + h.w / 2, h.y + h.h / 2);
	}
	key(k) {
		return this.page.keyboard.press(k);
	}
	// снимок после смены экрана: ждём конца переходной «шторки» из квадратов (drawTrans, TRT 0,42 с)
	async shot(name) {
		await this.page.waitForFunction("typeof TRT === 'undefined' || TRT <= 0", { timeout: 3000, polling: "raf" }).catch(() => {});
		const file = path.join(OUT, (this.tag ? this.tag + "_" : "") + name + ".png");
		await this.page.screenshot({ path: file });
		return file;
	}
	// ошибки: исключения страницы, console.error, журнал ERRS самой игры (05_err.js)
	async errors() {
		let errs = [];
		try {
			errs = await this.ev("typeof __dev === 'object' ? __dev.errs().map((e) => e.kind + ': ' + e.msg) : []");
		} catch (_) {}
		return this.console.concat(errs);
	}
	async clean(what) {
		const e = await this.errors();
		ok(!e.length, what + ": без ошибок", e.slice(0, 5).join(" | "));
	}
}

async function page(browser, { width, height, dpr = 1, mobile = false }) {
	const ctx = await browser.createBrowserContext(); // своё хранилище на каждый проход
	const p = await ctx.newPage();
	await p.setViewport({ width, height, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile });
	return p;
}

const stage = (n) => report.push(n);

// ---------- desktop: мышь, клавиатура, DOM-окно экспорта, resize ----------
async function desktop(browser) {
	stage("desktop 1280×720, мышь — " + path.relative(ROOT, HTML));
	const g = new Game(await page(browser, { width: 1280, height: 720 }), { tag: "d" });
	await g.open(HTML);
	await g.clean("загрузка");
	const f0 = await g.ev("FRAME_N");
	await sleep(400);
	ok((await g.ev("FRAME_N")) - f0 >= 10, "цикл кадров идёт на requestAnimationFrame");
	await g.ev(`__dev.seed(${SEED}); __dev.newGame()`);
	await g.shot("01_menu");

	await g.click("Новая игра");
	await g.until("__dev.S === 'pick'", 5000, "клик «Новая игра» не открыл выбор бойца");
	ok(true, "клик мышью по кнопке канваса (письмо-коробка)");
	await g.shot("02_pick");
	await g.tap(609 - 262, 88 + 165); // левая карточка
	await g.click("В поход!");
	await g.until("__dev.S === 'map'", 5000, "«В поход!» не открыл карту");
	await g.shot("03_map");
	await g.tap(343 + 30, 470 + 30); // карточка бойца
	await sleep(250);
	await g.shot("04_map_hero_card");
	await g.tap(20, 20);

	// бой с клавиатуры: пробел — расстановка, пробел — в бой, Escape — пауза
	await g.ev('__dev.fight("norm")');
	await g.until("__dev.S === 'prep'", 5000);
	await sleep(300);
	await g.key("Space");
	await sleep(300);
	await g.shot("05_prep_placed");
	await g.key("Space");
	await g.until("__dev.S === 'fight'", 5000, "пробел не начал бой");
	ok(true, "клавиатура: пробел → расстановка → бой");
	await sleep(700);
	await g.shot("06_fight");
	await g.key("Escape");
	await sleep(150);
	ok(await g.ev("__dev.paused === true"), "Escape ставит паузу");
	await g.shot("07_pause");
	await g.key("Escape");
	await sleep(150);
	ok(await g.ev("__dev.paused === false"), "Escape снимает паузу");
	await g.until("__dev.S !== 'fight'", 60000, "бой не закончился за минуту");
	await g.shot("08_after_fight");
	for (let i = 0; i < 12 && (await g.S()) === "msg"; i++) {
		await g.key("Space");
		await sleep(400);
	}
	ok((await g.S()) === "map", "после боя и событий — карта", "экран " + (await g.S()));
	await g.clean("карта → бой → карта");

	// настройки и DOM-окно экспорта: настоящий textarea, Blob и скачивание файла
	await g.ev("__dev.autosave(); __dev.S = 'menu'");
	await sleep(150);
	await g.click("Настройки");
	await g.until("__dev.S === 'settings'", 5000);
	await g.shot("09_settings");
	// Настоящий двухминутный замер, смена экрана и скачивание отчёта.
	const cdp = await browser.target().createCDPSession();
	await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: OUT, browserContextId: g.page.browserContext().id });
	await g.click("Отчёт");
	await g.click("Назад");
	await g.until("__dev.S === 'menu'", 5000);
	await g.until("!!document.querySelector('#mx-perf-text')", 130000, "отчёт не появился через 2 минуты");
	const perf = await g.ev("document.querySelector('#mx-perf-text').value");
	ok(/Длительность: 12[0-9]/.test(perf) && /ПО СЕКУНДАМ/.test(perf) && /20 САМЫХ ДОЛГИХ КАДРОВ/.test(perf) && /экран menu/.test(perf) && /User-Agent:/.test(perf), "отчёт: 2 минуты, хронология, пики и условия");
	await g.page.click("#mx-perf-dl");
	await g.until("/скачан/.test(document.querySelector('#mx-perf-msg').textContent)", 5000, "отчёт не скачан");
	let perfFile = null;
	for (let i = 0; i < 20 && !perfFile; i++) {
		await sleep(100);
		perfFile = fs.readdirSync(OUT).find((f) => /^otchyot-proizvoditelnosti-.*\.txt$/.test(f));
	}
	ok(perfFile && fs.readFileSync(path.join(OUT, perfFile), "utf8") === perf, "скачанный отчёт совпадает с текстом");
	await g.page.click("#mx-perf-copy");
	await g.until("!!document.querySelector('#mx-perf-msg').textContent", 5000, "кнопка копирования не ответила");
	await g.page.click("#mx-perf-close");
	await g.until("!document.querySelector('#mx-perf')", 3000, "отчёт не закрылся");
	await g.click("Настройки");
	await g.until("__dev.S === 'settings'", 5000);
	await g.click("Экспорт");
	await g.until("document.querySelector('#mx-save-text') && document.querySelector('#mx-save-text').value.length > 20", 5000, "окно экспорта не показало сохранение");
	const save = JSON.parse(await g.ev("document.querySelector('#mx-save-text').value"));
	ok(save && typeof save === "object" && save.v > 0, "экспорт: в окне JSON сохранения v" + (save && save.v));
	await g.page.click("#mx-save-dl");
	await g.until("/скачан/.test(document.querySelector('#mx-save-msg').textContent)", 5000, "кнопка «Скачать файл» не отчиталась");
	let dl = null;
	for (let i = 0; i < 20 && !dl; i++) {
		await sleep(100);
		dl = fs.readdirSync(OUT).find((f) => /^probuzhdenie-monstrov-save-.*\.json$/.test(f));
	}
	ok(dl && JSON.parse(fs.readFileSync(path.join(OUT, dl), "utf8")).v === save.v, "скачанный файл сохранения совпадает с окном", "файл не появился в " + OUT);
	await g.shot("10_export");
	await g.page.click("#mx-save-close");
	await g.until("!document.querySelector('#mx-save')", 3000, "окно экспорта не закрылось");
	// импорт: скачанный файл обратно через <input type=file> (настоящий FileReader) и кнопку «Загрузить»
	await g.click("Импорт");
	await g.until("!!document.querySelector('#mx-save-file')", 3000, "окно импорта не открылось");
	await (await g.page.$("#mx-save-file")).uploadFile(path.join(OUT, dl));
	await g.until("/прочитан/.test(document.querySelector('#mx-save-msg').textContent)", 5000, "FileReader не прочитал файл");
	await g.page.click("#mx-save-load");
	await g.until("/загружено/.test(document.querySelector('#mx-save-msg').textContent)", 5000, "импорт не принял скачанный файл");
	ok(true, "импорт: файл → FileReader → «Загрузить» → сохранение принято");
	await g.shot("11_import");
	await g.page.click("#mx-save-close");
	await g.until("!document.querySelector('#mx-save')", 3000, "окно импорта не закрылось");

	// кнопка разработчика (только в сборке с редактором): настоящий клик по канвасу → DOM-окно пароля
	const isPublic = await g.ev("window.__mxPublic === true");
	if (!isPublic) {
		await g.click("Режим разработчика");
		await g.until("!!document.querySelector('#mx-dev-ov')", 3000, "кнопка «Режим разработчика» не показала окно пароля");
		await g.page.click("#mx-dev-no");
		await g.until("!document.querySelector('#mx-dev-ov')", 3000, "окно пароля не закрылось по «Отмена»");
		ok(true, "«Режим разработчика» → окно пароля → отмена");
	}

	// изменение размера окна на лету: fit() пересчитывает письмо-коробку, клики остаются точными
	await g.page.setViewport({ width: 900, height: 900 });
	await sleep(250);
	// fit() растягивает канвас на всё окно, письмо-коробку даёт object-fit: contain — поэтому rect = окно
	const r = await g.ev("(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return [r.width, r.height, getComputedStyle(document.querySelector('canvas')).objectFit]; })()");
	ok(r[0] === 900 && r[1] === 900 && r[2] === "contain", "resize 900×900: fit() растянул канвас на окно, object-fit: contain", r.join("×"));
	await g.click("Назад");
	await g.until("__dev.S === 'menu'", 5000, "«Назад» после resize промахнулся");
	await g.click("Коллекция");
	await g.until("__dev.S === 'codex'", 5000, "«Коллекция» после resize промахнулась");
	ok(true, "клики точны после resize");
	await g.shot("12_codex_900x900");
	await g.page.setViewport({ width: 1280, height: 720 });
	await sleep(200);
	await g.ev("__dev.S = 'menu'");
	await sleep(100);
	const fps = await g.ev(
		() =>
			new Promise((r) => {
				let n = 0;
				const t0 = performance.now();
				const f = () => (++n, performance.now() - t0 < 2000 ? requestAnimationFrame(f) : r(+(n / ((performance.now() - t0) / 1000)).toFixed(1)));
				requestAnimationFrame(f);
			}),
	);
	report.push("  · меню: " + fps + " к/с (headless, программный растеризатор)");
	await g.clean("desktop");
	await g.page.browserContext().close();
}

// ---------- телефон: тач в портрете (канвас повёрнут CSS-ом) и в альбоме, DPR 2 ----------
async function mobile(browser) {
	stage("mobile 390×844 DPR 2, тач — " + path.relative(ROOT, HTML));
	const g = new Game(await page(browser, { width: 390, height: 844, dpr: 2, mobile: true }), { tag: "m", touch: true });
	await g.open(HTML);
	await g.clean("загрузка");
	const CV = "(() => { const c = document.querySelector('canvas'), r = c.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), getComputedStyle(c).transform, c.width, devicePixelRatio]; })()";
	// hiDpi(): R = max(1, min(2, round(max(ширина, высота) · DPR / 1218))) — у телефона 844·2/1218 ≈ 1,4 → R = 1
	const wantR = (w, h, dpr) => Math.max(1, Math.min(2, Math.round((Math.max(w, h) * dpr) / 1218)));
	let r = await g.ev(CV);
	ok(r[0] === 390 && r[1] === 844 && /^matrix\(0, 1, -1, 0/.test(r[2]), "портрет: канвас повёрнут на 90° (" + r[0] + "×" + r[1] + ", " + r[2] + ")");
	ok(r[4] === 2 && r[3] === 1218 * wantR(390, 844, 2), "hiDpi на телефоне DPR 2: буфер " + r[3] + " px (R = " + wantR(390, 844, 2) + ")", "буфер " + r[3]);
	await g.ev(`__dev.seed(${SEED}); __dev.newGame()`);
	await g.shot("01_menu_portrait");
	await g.click("Новая игра");
	await g.until("__dev.S === 'pick'", 5000, "тап по «Новая игра» в портрете промахнулся");
	ok(true, "тап в портрете через поворот → выбор бойца");
	await g.tap(609 - 262, 88 + 165);
	await g.click("В поход!");
	await g.until("__dev.S === 'map'", 5000, "тап «В поход!» в портрете промахнулся");
	await g.shot("02_map_portrait");
	await g.ev("__dev.S = 'menu'");
	await g.page.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
	await sleep(250);
	await g.click("Коллекция");
	await g.until("__dev.S === 'codex'", 5000, "тап в альбоме после поворота промахнулся");
	ok(true, "поворот в альбом на лету, тап точен");
	await g.shot("03_codex_landscape");
	// планшет 1024×1366 DPR 2: hiDpi() переключается на R = 2 (буфер 2436×1080), тап через поворот точен
	await g.ev("__dev.S = 'menu'");
	await g.page.setViewport({ width: 1024, height: 1366, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
	await sleep(250);
	r = await g.ev(CV);
	ok(r[3] === 1218 * 2 && wantR(1024, 1366, 2) === 2 && /^matrix\(0, 1, -1, 0/.test(r[2]), "планшет DPR 2: буфер " + r[3] + " px (R = 2), портрет", r.join(" "));
	await g.click("Настройки");
	await g.until("__dev.S === 'settings'", 5000, "тап на планшете (R = 2) промахнулся");
	ok(true, "тап на планшете при R = 2 точен");
	await g.shot("04_settings_tablet");
	await g.clean("mobile");
	await g.page.browserContext().close();
}

// ---------- публичная сборка: без редактора и кнопки разработчика ----------
async function pub(browser) {
	if (!fs.existsSync(PUBLIC)) return report.push("public: нет " + path.relative(ROOT, PUBLIC) + " — пропуск (npm run build:dist)");
	stage("public — " + path.relative(ROOT, PUBLIC));
	const g = new Game(await page(browser, { width: 1280, height: 720 }), { tag: "p" });
	await g.open(PUBLIC);
	await g.clean("загрузка");
	ok(await g.ev("window.__mxPublic === true && !!window.__mxStorage"), "runner: __mxPublic и __mxStorage");
	ok(await g.ev("typeof MXCore === 'undefined' && typeof window.mxGate === 'undefined'"), "редактора (MXCore, mxGate) нет");
	await g.click("Настройки");
	await g.until("__dev.S === 'settings'", 5000);
	const labels = await g.labels();
	ok(!labels.some((l) => /разработчик/i.test(l)), "в настройках нет кнопки разработчика", labels.join(", "));
	ok(labels.some((l) => /Экспорт/.test(l)), "кнопки экспорта/импорта на месте");
	await g.shot("01_settings");
	await g.click("Назад");
	await g.until("__dev.S === 'menu'", 5000);
	await g.clean("public");
	await g.page.browserContext().close();
}

// ---------- редактор: окно пароля на настоящем WebCrypto (PBKDF2); верный пароль — из MX_EDITOR_PASSWORD ----------
async function editor(browser) {
	stage("editor — " + path.relative(ROOT, HTML));
	const g = new Game(await page(browser, { width: 1280, height: 720 }), { tag: "e" });
	await g.open(HTML);
	if (await g.ev("window.__mxPublic === true")) return report.push("  · сборка публичная — редактора нет, пропуск");
	await g.ev("mxGate(true)");
	await g.until("!!document.querySelector('#mx-dev-in')", 3000, "mxGate не показал окно пароля");
	await g.page.type("#mx-dev-in", "заведомо-неверный-пароль");
	await g.page.click("#mx-dev-ok");
	await g.until("document.querySelector('#mx-dev-err').textContent === 'Неверный пароль'", 15000, "неверный пароль не отклонён");
	ok(await g.ev("window.__mxUnlocked === false && document.querySelector('#mx-dev-in').value === ''"), "неверный пароль: PBKDF2 в браузере, отказ, поле очищено");
	await g.shot("01_gate_wrong");
	const pwd = process.env.MX_EDITOR_PASSWORD;
	if (!pwd) report.push("  · MX_EDITOR_PASSWORD не задан — вход верным паролем пропущен");
	else {
		await g.page.type("#mx-dev-in", pwd);
		await g.page.keyboard.press("Enter");
		await g.until("window.__mxUnlocked === true", 15000, "верный пароль не принят");
		ok(await g.ev("!document.querySelector('#mx-dev-ov') && getComputedStyle(document.querySelector('#mx-b')).display !== 'none'"), "верный пароль: окно закрыто, кнопка редактора показана");
		await g.page.click("#mx-b");
		await g.until("document.querySelector('#mx-p').classList.contains('on')", 3000, "панель редактора не открылась");
		ok(true, "панель редактора открывается");
		await g.shot("02_editor_panel");
	}
	await g.clean("editor");
	await g.page.browserContext().close();
}

const PASSES = { desktop, mobile, public: pub, editor };
const t0 = Date.now();
let browser;
try {
	browser = await launch();
	report.push("Chromium: " + (await browser.version()));
	for (const name of ONLY) {
		if (!PASSES[name]) fail("--only", "неизвестный проход " + name + " (есть: " + Object.keys(PASSES).join(", ") + ")");
		await PASSES[name](browser);
	}
	console.log(report.join("\n"));
	console.log("снимки:", OUT);
	console.log("browser-tour: все проходы прошли за " + ((Date.now() - t0) / 1000).toFixed(1) + " с");
} catch (e) {
	console.log(report.join("\n"));
	console.error("browser-tour: ПРОВАЛ — " + (e && e.message));
	if (!(e && e.step)) console.error(e && e.stack);
	console.error("снимки:", OUT);
	process.exitCode = 1;
} finally {
	if (browser) await browser.close().catch(() => {});
}
