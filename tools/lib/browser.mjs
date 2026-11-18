// Настоящий Chromium из npm — для проверок, которым мало заглушки DOM (tools/browser-tour.mjs).
// Бинарник берётся из пакета @sparticuz/chromium (внутри тарбола, без загрузок с CDN — в песочнице
// доступен только реестр npm), управление — puppeteer-core. Оба пакета не входят в зависимости
// проекта (~100 МБ на диске): `npm run browser:setup` ставит их в .cache/browser (в .gitignore,
// `npm install` их не трогает); годятся и обычные node_modules. Только Linux x64 — на другой ОС
// укажите свой Chrome: PUPPETEER_EXECUTABLE_PATH=/путь/к/chrome.
// Вне AWS Lambda пакет не распаковывает системные библиотеки (libnss3 и др.) — делаем это сами
// и передаём LD_LIBRARY_PATH процессу браузера.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DIRS = [path.join(ROOT, ".cache/browser"), ROOT];

function resolveOrExplain(name, hint = "") {
	for (const d of DIRS) {
		try {
			return require.resolve(name, { paths: [d] });
		} catch (_) {}
	}
	throw new Error(`нет пакета ${name}: выполните \`npm run browser:setup\` (puppeteer-core + @sparticuz/chromium)` + hint);
}

// распаковать .tar.br из пакета в /tmp/<имя> (один раз); возвращает каталог
async function inflate(binDir, name) {
	const lambdafs = require(path.join(binDir, "../build/lambdafs.js")).default;
	return lambdafs.inflate(path.join(binDir, name));
}

export async function chromePath(env) {
	if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
	const pkg = resolveOrExplain("@sparticuz/chromium/package.json", " или укажите свой браузер в PUPPETEER_EXECUTABLE_PATH");
	const chromium = require(path.dirname(pkg)); // CJS: module.exports = класс со статикой
	const binDir = path.join(path.dirname(pkg), "bin");
	const exe = await chromium.executablePath(binDir); // /tmp/chromium (+ шрифты, swiftshader)
	const lib = await inflate(binDir, "al2023.tar.br"); // libnss3, libnspr4, libexpat…: их нет в образе
	const fonts = fs.existsSync("/tmp/fonts") ? "/tmp/fonts" : await inflate(binDir, "fonts.tar.br");
	env.LD_LIBRARY_PATH = [path.join(lib, "lib"), env.LD_LIBRARY_PATH].filter(Boolean).join(":");
	env.FONTCONFIG_PATH = env.FONTCONFIG_PATH || fonts;
	return exe;
}

// Запустить браузер. mobile — тач-экран телефона (поворот игра делает сама).
// --disable-gpu: без него Chromium гонит 2D-канвас через SwiftShader (GL в софте) — 9 к/с в меню;
// с программным растеризатором Skia — 60 к/с (замер в песочнице, этап O).
export async function launch({ width = 1280, height = 720, dpr = 1, mobile = false, args = [] } = {}) {
	const puppeteer = (await import(pathToFileURL(resolveOrExplain("puppeteer-core")).href)).default;
	const env = { ...process.env };
	const executablePath = await chromePath(env);
	const browser = await puppeteer.launch({
		executablePath,
		env,
		headless: true,
		args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--no-zygote", "--disable-gpu", "--mute-audio", "--no-first-run", "--hide-scrollbars", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "--autoplay-policy=no-user-gesture-required", ...args],
		defaultViewport: { width, height, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile },
	});
	return browser;
}
