// Заглушка браузерного окружения для headless-прогона игры в Node.
// Намеренно минимальная: вся отрисовка — no-op, но API canvas/DOM присутствует,
// чтобы игровой код не падал и можно было проверять логику, сохранения и переходы экранов.
// Необязательные параметры позволяют подменить холст и Image на настоящие (см. tools/shots.mjs):
//   canvasFactory(w, h) — вернуть объект с width/height/getContext; ImageClass — класс с src/onload.
// Заглушка 2D-контекста: методы лежат в прототипе, чтобы каждый новый холст стоил байты, а не
// полсотни замыканий — иначе рост кучи в soak-тесте измерял бы заглушку, а не кэши игры.
const gradient = () => ({ addColorStop() {} });
const pixels = (w, h) => {
	w = Math.max(1, Math.round(w || 1));
	h = Math.max(1, Math.round(h || 1));
	return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
};
class StubCtx {
	constructor(canvas) {
		this.canvas = canvas;
	}
	measureText(t) {
		return { width: String(t).length * 8 };
	}
	createLinearGradient() {
		return gradient();
	}
	createRadialGradient() {
		return gradient();
	}
	createConicGradient() {
		return gradient();
	}
	createPattern() {
		return {};
	}
	getImageData(x, y, w, h) {
		return pixels(w, h);
	}
	createImageData(w, h) {
		return pixels(w, h);
	}
}
for (const m of "save restore translate rotate scale setTransform resetTransform clearRect fillRect strokeRect beginPath closePath moveTo lineTo quadraticCurveTo bezierCurveTo arc ellipse rect fill stroke clip fillText strokeText drawImage setLineDash putImageData drawFocusIfNeeded".split(" "))
	StubCtx.prototype[m] = function () {};
// ширина и высота PNG из первых байт data-URL (IHDR: байты 16–23), иначе null
function pngSize(src) {
	if (typeof src !== "string" || !src.startsWith("data:image/png;base64,")) return null;
	const b = Buffer.from(src.slice(22, 22 + 44), "base64");
	if (b.length < 24 || b[1] !== 0x50 || b[2] !== 0x4e) return null;
	return [b.readUInt32BE(16), b.readUInt32BE(20)];
}
const noClass = { add() {}, remove() {}, toggle() {}, contains: () => false };
class StubCanvas {
	constructor(id, w, h) {
		this._id = id;
		this.width = w || 300;
		this.height = h || 150;
		this.style = {};
		this.dataset = {};
		this.listeners = {};
		this._ctx = null;
	}
	get classList() {
		return noClass;
	}
	getContext() {
		return this._ctx || (this._ctx = new StubCtx(this));
	}
	addEventListener(t, f) {
		(this.listeners[t] = this.listeners[t] || []).push(f);
	}
	removeEventListener() {}
	getBoundingClientRect() {
		return { left: 0, top: 0, width: this.width, height: this.height, right: this.width, bottom: this.height };
	}
	appendChild() {}
	remove() {}
	setAttribute() {}
	querySelector() {
		return null;
	}
	toDataURL() {
		return "data:,";
	}
}

export function createDom({ width = 1280, height = 720, dpr = 2, canvasFactory = null, ImageClass = null } = {}) {
	let canvasCount = 0;
	// настоящий холст (если передан) дополняем полями DOM-элемента, которых у него нет
	const realCanvas = (w, h) => {
		const c = canvasFactory(w || 300, h || 150);
		c._id = ++canvasCount;
		c.style = {};
		c.dataset = {};
		c.classList = { add() {}, remove() {}, toggle() {}, contains: () => false };
		c.listeners = {};
		c.addEventListener = function (t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); };
		c.removeEventListener = () => {};
		c.getBoundingClientRect = function () { return { left: 0, top: 0, width: this.width, height: this.height, right: this.width, bottom: this.height }; };
		c.appendChild = () => {};
		c.remove = () => {};
		c.setAttribute = () => {};
		c.querySelector = () => null;
		return c;
	};
	const makeCanvas = (w, h) => (canvasFactory ? realCanvas(w, h) : new StubCanvas(++canvasCount, w, h));

	const makeEl = (tag) =>
		tag === "canvas"
			? makeCanvas()
			: {
					tagName: String(tag).toUpperCase(),
					style: {}, dataset: {}, children: [],
					classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
					listeners: {},
					addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); },
					removeEventListener() {}, appendChild() {}, remove() {},
					setAttribute() {}, removeAttribute() {},
					querySelector: () => null, querySelectorAll: () => [],
					getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 40, right: 100, bottom: 40 }; },
					focus() {}, blur() {},
				};

	const mainCanvas = makeCanvas(1218, 540);
	const rafQueue = [];
	const winListeners = {};
	const docListeners = {};
	const store = (init) => {
		const m = new Map(init || []);
		return { getItem: (k) => (m.has(String(k)) ? m.get(String(k)) : null), setItem: (k, v) => m.set(String(k), String(v)), removeItem: (k) => m.delete(String(k)), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; } };
	};

	const document = {
		getElementById: (id) => (id === "c" ? mainCanvas : makeEl("div")),
		createElement: (tag) => makeEl(tag),
		querySelector: () => makeEl("div"),
		querySelectorAll: () => [],
		addEventListener(t, f) { (docListeners[t] = docListeners[t] || []).push(f); },
		removeEventListener() {},
		body: makeEl("body"),
		documentElement: makeEl("html"),
		fonts: { add() {}, ready: Promise.resolve() },
		hidden: false,
		activeElement: null,
		hasFocus: () => true,
	};

	const noop = () => {};
	const windowObj = {
		document,
		innerWidth: width,
		innerHeight: height,
		devicePixelRatio: dpr,
		addEventListener(t, f) { (winListeners[t] = winListeners[t] || []).push(f); },
		removeEventListener() {},
		requestAnimationFrame(f) { rafQueue.push(f); return rafQueue.length; },
		cancelAnimationFrame() {},
		setTimeout: (f) => setTimeout(f, 0),
		clearTimeout,
		setInterval: () => 0,
		clearInterval: noop,
		location: { hash: "", href: "http://localhost/", reload() {} },
		localStorage: store(),
		__mxStorage: store(),
		navigator: { userAgent: "node-harness", hardwareConcurrency: 4, deviceMemory: 8, maxTouchPoints: 0 },
		screen: { orientation: { lock: () => Promise.resolve() } },
		performance: { now: () => Date.now() },
		matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
		getComputedStyle: () => ({ getPropertyValue: () => "" }),
		console,
		Image: ImageClass || class {
			constructor() { this.width = 64; this.height = 64; this.complete = false; }
			// размеры берём из заголовка PNG (data-URL), чтобы холсты-копии атласов в кэшах были настоящего размера
			set src(v) { this._src = v; const d = pngSize(v); if (d) [this.width, this.height] = d; setTimeout(() => { this.complete = true; if (this.onload) this.onload({}); }, 0); }
			get src() { return this._src; }
			decode() { return Promise.resolve(); }
		},
		FontFace: class { constructor() {} load() { return Promise.resolve(this); } },
		alert() {}, close() {},
		AudioContext: undefined,
	};
	windowObj.window = windowObj;
	windowObj.self = windowObj;
	windowObj.globalThis = windowObj;
	windowObj.top = windowObj;
	windowObj.parent = windowObj;

	return { mainCanvas, rafQueue, winListeners, docListeners, document, windowObj, store };
}
