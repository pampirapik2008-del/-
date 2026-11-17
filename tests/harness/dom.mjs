// Заглушка браузерного окружения для headless-прогона игры в Node.
// Намеренно минимальная: вся отрисовка — no-op, но API canvas/DOM присутствует,
// чтобы игровой код не падал и можно было проверять логику, сохранения и переходы экранов.
// Необязательные параметры позволяют подменить холст и Image на настоящие (см. tools/shots.mjs):
//   canvasFactory(w, h) — вернуть объект с width/height/getContext; ImageClass — класс с src/onload.
export function createDom({ width = 1280, height = 720, dpr = 2, canvasFactory = null, ImageClass = null } = {}) {
	const gradient = () => ({ addColorStop() {} });
	const makeCtx = (canvas) => ({
		canvas,
		save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, setTransform() {}, resetTransform() {},
		clearRect() {}, fillRect() {}, strokeRect() {}, beginPath() {}, closePath() {}, moveTo() {},
		lineTo() {}, quadraticCurveTo() {}, bezierCurveTo() {}, arc() {}, ellipse() {}, rect() {},
		fill() {}, stroke() {}, clip() {}, fillText() {}, strokeText() {}, drawImage() {},
		setLineDash() {}, putImageData() {}, drawFocusIfNeeded() {},
		measureText: (t) => ({ width: String(t).length * 8 }),
		createLinearGradient: gradient, createRadialGradient: gradient, createConicGradient: gradient,
		createPattern: () => ({}),
		getImageData(x, y, w, h) {
			w = Math.max(1, Math.round(w || 1));
			h = Math.max(1, Math.round(h || 1));
			return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
		},
		createImageData(w, h) {
			w = Math.max(1, Math.round(w || 1));
			h = Math.max(1, Math.round(h || 1));
			return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
		},
	});

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
	const makeCanvas = (w, h) => canvasFactory ? realCanvas(w, h) : ({
		_id: ++canvasCount,
		width: w || 300,
		height: h || 150,
		style: {},
		dataset: {},
		classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
		listeners: {},
		getContext() {
			if (!this._ctx) this._ctx = makeCtx(this);
			return this._ctx;
		},
		addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); },
		removeEventListener() {},
		getBoundingClientRect() { return { left: 0, top: 0, width: this.width, height: this.height, right: this.width, bottom: this.height }; },
		appendChild() {}, remove() {}, setAttribute() {}, querySelector: () => null,
		toDataURL: () => "data:,",
	});

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
			set src(v) { this._src = v; setTimeout(() => { this.complete = true; if (this.onload) this.onload({}); }, 0); }
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
