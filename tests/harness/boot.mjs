// Запуск игры из src/ в Node без браузера.
// Возвращает управление кадром (step), ввод (key/click) и отладочный API (__dev).
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { createDom } from "./dom.mjs";
import { loadAssetsJs, loadGameSrc } from "../../tools/lib/assemble.mjs";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEVAPI = fs.readFileSync(path.join(ROOT, "tests/harness/devapi.js"), "utf8");

const FRAME_MS = 1000 / 60;

// dom — готовое окружение из createDom(); по умолчанию заглушка без растеризации.
// code — готовый код игры (ассеты + секции); по умолчанию собирается из src/ и assets/.
// bakeMs — бюджет порции запекания карты за кадр (по умолчанию вся карта в первом кадре).
export function boot({ quiet = true, dom = createDom(), code = null, bakeMs = null } = {}) {
	const { windowObj, document, rafQueue, winListeners, mainCanvas } = dom;
	const errors = [];
	let fatal = null;

	const sandbox = Object.assign(Object.create(null), {
		window: windowObj,
		self: windowObj,
		globalThis: windowObj,
		document,
		navigator: windowObj.navigator,
		__hrnow: () => Number(process.hrtime.bigint()) / 1e6,
		// бюджет порции запекания карты: по умолчанию вся карта за один кадр (детерминированные снимки);
		// тесты нарезки передают маленькое значение
		__mxBakeMs: typeof bakeMs === "number" ? bakeMs : 1e9,
		screen: windowObj.screen,
		location: windowObj.location,
		localStorage: windowObj.localStorage,
		performance: windowObj.performance,
		requestAnimationFrame: windowObj.requestAnimationFrame,
		cancelAnimationFrame: windowObj.cancelAnimationFrame,
		setTimeout: windowObj.setTimeout,
		clearTimeout,
		setInterval: windowObj.setInterval,
		clearInterval,
		console: {
			log: () => {},
			info: () => {},
			debug: () => {},
			warn: (...a) => errors.push("WARN " + a.map(String).join(" ")),
			error: (...a) => errors.push(a.map(String).join(" ")),
		},
		Image: windowObj.Image,
		FontFace: windowObj.FontFace,
		innerWidth: windowObj.innerWidth,
		innerHeight: windowObj.innerHeight,
		devicePixelRatio: windowObj.devicePixelRatio,
		addEventListener: windowObj.addEventListener,
		removeEventListener: windowObj.removeEventListener,
		matchMedia: windowObj.matchMedia,
		getComputedStyle: windowObj.getComputedStyle,
		alert() {},
		Date,
		Math,
		JSON,
		Promise,
		Map,
		Set,
		WeakMap,
		Symbol,
		Reflect,
		Error,
		TypeError,
		RangeError,
		Object,
		Array,
		String,
		Number,
		Boolean,
		Intl,
		Uint8ClampedArray,
		Uint8Array,
		Int16Array,
		Float32Array,
		ArrayBuffer,
		isFinite,
		isNaN,
		parseInt,
		parseFloat,
		encodeURIComponent,
		decodeURIComponent,
	});

	const preKeys = new Set(Object.keys(sandbox));
	const ctx = vm.createContext(sandbox);
	const src = (code == null ? loadAssetsJs(ROOT) + "\n" + loadGameSrc(ROOT) : code) + "\n" + DEVAPI;
	vm.runInContext(src, ctx, { filename: "game.js" });

	let ts = 0;
	let frames = 0;
	const flush = () => {
		const q = rafQueue.splice(0, rafQueue.length);
		ts += FRAME_MS;
		for (const f of q) {
			try {
				f(ts);
			} catch (e) {
				if (quiet) fatal = fatal || e;
				else throw e;
				frames++;
				return false;
			}
		}
		frames++;
		return true;
	};

	// devapi вешает API на globalThis, а внутри vm это windowObj
	const dev = windowObj.__dev;
	if (!dev) throw new Error("__dev не появился: devapi не подключился");

	const storage = windowObj.__mxStorage;

	return {
		dev,
		errors,
		storage,
		// имена, появившиеся в глобальной области после запуска (для проверки неявных глобалов)
		newGlobals() {
			return Object.keys(sandbox).filter((k) => !preKeys.has(k));
		},
		setStorage(k, v) {
			storage.setItem(k, String(v));
		},
		readStorage(k) {
			return storage.getItem(k);
		},
		delStorage(k) {
			storage.removeItem(k);
		},
		clearFatal() {
			fatal = null;
		},
		get fatal() {
			return fatal;
		},
		get frames() {
			return frames;
		},
		// дать отработать загрузке ассетов (промисы/таймеры загрузчика) без прокрутки кадров
		async ready(maxMs = 3000) {
			const t0 = Date.now();
			while (Date.now() - t0 < maxMs) {
				if (dev.G) return true;
				await new Promise((r) => setTimeout(r, 1));
			}
			return !!dev.G;
		},
		step(n = 1) {
			for (let i = 0; i < n; i++) if (!flush()) break;
			return this;
		},
		key(k) {
			for (const f of winListeners["keydown"] || []) {
				try {
					f({ key: k, repeat: false, preventDefault() {} });
				} catch (e) {
					fatal = fatal || e;
				}
			}
		},
		click(lx, ly) {
			const w = windowObj.innerWidth,
				h = windowObj.innerHeight,
				s = Math.min(w / 1218, h / 540),
				cx = lx * s + (w - 1218 * s) / 2,
				cy = ly * s + (h - 540 * s) / 2;
			for (const f of mainCanvas.listeners["pointerdown"] || []) {
				try {
					f({ clientX: cx, clientY: cy, pointerId: 1, isPrimary: true, preventDefault() {}, stopPropagation() {} });
				} catch (e) {
					fatal = fatal || e;
				}
			}
		},
		clickHit(h) {
			if (h) this.click(h.x + h.w / 2, h.y + h.h / 2);
		},
	};
}
