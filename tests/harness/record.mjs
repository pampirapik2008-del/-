// Регистратор команд холста для тестов и инструментов (abcmd, тесты отрисовки).
// Заглушечные холсты, чьи контексты записывают каждую команду строкой вида `c1.fillRect(0,0,10,10)`,
// пока log.on === true. Номера холстов и градиентов выдаются по порядку ПЕРВОГО ПОЯВЛЕНИЯ в журнале,
// а не создания — иначе лишний оффскрин при загрузке сдвигал бы все номера.
// Использование: const r = recorder(); const dom = createDom({ canvasFactory: r.canvasFactory }); r.log.on = true; …
export function recorder() {
	const log = { lines: [], on: false };
	let ids = 0,
		gids = 0;
	const calias = new Map(),
		galias = new Map();
	const al = (m, k) => {
		if (!m.has(k)) m.set(k, m.size + 1);
		return m.get(k);
	};
	const fmt = (v) => {
		if (v === null || v === undefined) return String(v);
		if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toPrecision(12);
		if (typeof v === "string" || typeof v === "boolean") return JSON.stringify(v);
		if (Array.isArray(v)) return "[" + v.map(fmt).join(",") + "]";
		if (v._cid) return "canvas#" + al(calias, v._cid);
		if (v._gid) return "grad#" + al(galias, v._gid);
		if (v.data && v.width) return "imgdata" + v.width + "x" + v.height;
		if (v.src !== undefined) return "img(" + String(v.src).slice(0, 24) + ")";
		return "obj";
	};
	// строка собирается лениво: номера-псевдонимы должны выдаваться только записанным командам
	const push = (f) => {
		if (log.on) log.lines.push(f());
	};
	const gradient = () => {
		const g = { _gid: ++gids, addColorStop: (o, c) => push(() => `grad#${al(galias, g._gid)}.stop(${fmt(o)},${fmt(c)})`) };
		return g;
	};
	const imgData = (w, h) => {
		w = Math.max(1, Math.round(w || 1));
		h = Math.max(1, Math.round(h || 1));
		return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
	};
	const makeCtx = (canvas) => {
		const base = {
			canvas,
			measureText: (t) => ({ width: String(t).length * 8 }),
			createLinearGradient: gradient,
			createRadialGradient: gradient,
			createConicGradient: gradient,
			createPattern: () => ({ _gid: ++gids }),
			getImageData: (x, y, w, h) => imgData(w, h),
			createImageData: (w, h) => imgData(w, h),
			getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
		};
		const state = {};
		const id = () => "c" + al(calias, canvas._cid);
		return new Proxy(base, {
			get(tgt, k) {
				if (k in tgt) {
					const v = tgt[k];
					if (typeof v === "function" && k !== "measureText" && k !== "getTransform")
						return (...a) => {
							push(() => `${id()}.${k}(${a.map(fmt).join(",")})`);
							return v.apply(tgt, a);
						};
					return v;
				}
				if (k in state) return state[k];
				return (...a) => push(() => `${id()}.${k}(${a.map(fmt).join(",")})`);
			},
			set(tgt, k, v) {
				state[k] = v;
				push(() => `${id()}.${k}=${fmt(v)}`);
				return true;
			},
		});
	};
	const canvasFactory = (w, h) => {
		const c = { _cid: ++ids, width: w || 300, height: h || 150, toDataURL: () => "data:," };
		let cx = null;
		c.getContext = () => cx || (cx = makeCtx(c));
		return c;
	};
	return { log, canvasFactory };
}


// тексты fillText из журнала (в порядке рисования)
export function drawnTexts(lines) {
	const out = [];
	for (const l of lines) {
		const m = /^c\d+\.fillText\((".*?"),/.exec(l);
		if (m) out.push(JSON.parse(m[1]));
	}
	return out;
}
// сколько раз вызвана команда (имя метода без холста), например count(lines, "drawImage")
export function count(lines, name) {
	let n = 0;
	for (const l of lines) if (l.indexOf("." + name + "(") > 0) n++;
	return n;
}
