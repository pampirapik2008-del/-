// ===== 30_arena.js =====
// ===== АРЕНА: генерация по сиду, препятствия и навигация, покрытия, свет, погода =====
const FLD = { x0: 96, x1: 1122, y1: 440 }; // поле боя (верхняя граница — мир.fy0)
const CELL = 14;
// след препятствия на земле (эллипс rx/ry), oy — насколько спрайт свисает ниже центра следа; hp — разрушаемое
const PROP = {
	spruce: { rx: 18, ry: 9, oy: 10 },
	snowfir: { rx: 15, ry: 8, oy: 8 },
	pillar: { rx: 26, ry: 11, oy: 12 },
	wall: { rx: 62, ry: 15, oy: 16 },
	boulder: { rx: 50, ry: 16, oy: 16 },
	rocks: { rx: 44, ry: 13, oy: 12 },
	stump: { rx: 34, ry: 12, oy: 14, hp: 3, deb: ["#8a5a36", "#6b4428", "#b98a5a"] },
	log: { rx: 46, ry: 11, oy: 14, hp: 3, deb: ["#8a5a36", "#6b4428", "#b98a5a"] },
	shrooms: { rx: 28, ry: 10, oy: 10, hp: 2, glow: "#5fd0ff", lr: 120, ly: -40, deb: ["#5fd0ff", "#b0f0ff", "#3a8ac0"] },
	campfire: { rx: 38, ry: 13, oy: 14, fire: 1, glow: "#ffb060", lr: 230, ly: -24 },
	lantern: { rx: 10, ry: 6, oy: 6, glow: "#ffd27a", lr: 170, lx: 26, ly: -84 },
};
const propDef = (n) => PROP[n.split("_")[0]];
// покрытия: slow — замедляет, slip — ускоряет, haz — жжёт/травит (всех одинаково)
const PATCH = {
	dirt: { c: ["#6b4a33", "#5a3f2c", "#4a3626"] },
	moss: { c: ["#2f5a36", "#28502f", "#234629"] },
	tiles: { c: ["#dcc48e", "#c6ab72", "#ab905e"], grid: 1 },
	pit: { c: ["#b58a48", "#a57c40", "#94703a"], slow: 0.7, n: "Зыбучий песок" },
	sheet: { c: ["#d2f4ff", "#a8e2f8", "#8fd0ee"], slip: 1.25, shine: 1, n: "Лёд" },
	drift: { c: ["#ffffff", "#eef6ff", "#d6e6f8"], slow: 0.72, n: "Сугроб" },
	lava: { c: ["#ffd45e", "#ff8a3c", "#b0301c"], haz: "fire", glow: "#ff8a3c", n: "Лава" },
	ashp: { c: ["#3a3438", "#332e32", "#2c282c"] },
	bog: { c: ["#1e3a3a", "#1a3232", "#162a2a"], slow: 0.72, shine: 1, n: "Трясина" },
	toxic: { c: ["#b8ff5e", "#7ad03c", "#3c8a28"], haz: "poison", glow: "#9be04e", n: "Ядовитая лужа" },
};
const TINTC = {};
function propImg(w) {
	if (!w.pt) return IMG.props;
	return TINTC["p" + w.i] || (TINTC["p" + w.i] = recolor(IMG.props, w.pt));
}
// атлас монстров, перекрашенный под мир: "a" — основная пара, "m" — тёмная родня
function mobImg(w, key) {
	const id = "m" + w.i + key;
	if (TINTC[id]) return TINTC[id];
	let rules = [];
	if (key === "m") {
		const q = w.tM || { to: (w.tA ? w.tA.to : 120) + 14, sat: (w.tA ? w.tA.sat : 1) * 0.9, val: (w.tA ? w.tA.val : 1) * 0.62 };
		rules = [{ h: GREEN_H, ...q }];
		if (w.tB) rules.push({ h: RED_H, ...w.tB });
	} else {
		if (w.tA) rules.push({ h: GREEN_H, ...w.tA });
		if (w.tB) rules.push({ h: RED_H, ...w.tB });
	}
	return (TINTC[id] = rules.length ? recolor(IMG.mobs, rules) : IMG.mobs);
}
function vnoise(x, y, s) {
	const h = (i, j) => {
		let n = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
		n = Math.imul(n ^ (n >>> 13), 1274126177);
		return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
	};
	const xi = Math.floor(x),
		yi = Math.floor(y),
		fx = x - xi,
		fy = y - yi,
		a = h(xi, yi),
		b = h(xi + 1, yi),
		c = h(xi, yi + 1),
		d = h(xi + 1, yi + 1),
		u = fx * fx * (3 - 2 * fx),
		v = fy * fy * (3 - 2 * fy);
	return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
let FOGC = null;
function fogSpr() {
	if (FOGC) return FOGC;
	const c = mkC(512, 128),
		x = c.getContext("2d"),
		R = rng32(77),
		g = glowSpr("#ffffff");
	for (let i = 0; i < 46; i++) {
		const px = R() * 512,
			py = 30 + R() * 68,
			r = 50 + R() * 90;
		x.globalAlpha = 0.1 + R() * 0.12;
		for (const o of [-512, 0, 512]) x.drawImage(g, px + o - r, py - r * 0.4, r * 2, r * 0.8);
	}
	return (FOGC = c);
}

function mkArena(seed, wi, kind) {
	const R = rng32(seed),
		w = WORLDS[wi],
		y0 = w.fy0,
		y1 = FLD.y1,
		A = { seed, wi, w, y0, obs: [], dec: [], patches: [], pools: [], gv: 0, nf: new Map(), em: {}, ev: 3, kind };
	A.tod = R() < 0.45 ? 0 : R() < 0.55 ? 1 : 2;
	A.wx = kind === "boss" ? w.wx[1] : R() < 0.4 ? w.wx[0] : w.wx[1 + ((R() * (w.wx.length - 1)) | 0)];
	if (A.wx === "eclipse" || A.wx === "storm") A.tod = 2;
	A.flip = R() < 0.5;
	const cx = 609,
		cy = (y0 + y1) / 2,
		hh = (y1 - y0) / 2,
		cand = [];
	const lay = kind === "boss" ? "ring" : ["open", "lanes", "choke", "scatter", "ring", "diag"][(R() * 6) | 0];
	A.lay = lay;
	if (lay === "open") for (let i = 0; i < 3; i++) cand.push([cx + (R() - 0.5) * 620, R() < 0.5 ? y0 + 14 : y1 - 10, R() < 0.6 ? "B" : "S"]);
	else if (lay === "lanes") {
		const n = hh > 92 ? 3 : 2;
		for (let i = 0; i < n; i++) cand.push([cx + (R() - 0.5) * 160, y0 + ((i + 0.5 + (R() - 0.5) * 0.3) * (y1 - y0)) / n, "B"]);
		cand.push([cx + (R() < 0.5 ? -1 : 1) * (240 + R() * 80), cy + (R() - 0.5) * hh, "S"]);
	} else if (lay === "choke") {
		const gap = y0 + 30 + R() * (y1 - y0 - 60),
			x = cx + (R() - 0.5) * 140;
		for (let y = y0 + 12; y < y1; y += 42) if (Math.abs(y - gap) > 46) cand.push([x + (R() - 0.5) * 30, y, R() < 0.7 ? "B" : "S"]);
	} else if (lay === "scatter") for (let i = 0; i < 6; i++) cand.push([300 + R() * 620, y0 + 14 + R() * (y1 - y0 - 24), R() < 0.3 ? "B" : "S"]);
	else if (lay === "ring") {
		const n = kind === "boss" ? 4 : 5;
		for (let i = 0; i < n; i++) {
			const a = (i / n) * TAU + R() * 0.5;
			cand.push([cx + Math.cos(a) * (300 + R() * 60), cy + Math.sin(a) * hh * 0.98, R() < 0.55 ? "B" : "S"]);
		}
	} else for (let i = 0; i < 3; i++) cand.push([cx - 220 + i * 220 + (R() - 0.5) * 60, y0 + 20 + (i * (y1 - y0 - 40)) / 2, i === 1 ? "B" : "S"]);
	// свет и разрушаемое — на каждой арене
	cand.push([R() < 0.5 ? 200 + R() * 120 : 900 + R() * 120, R() < 0.5 ? y0 + 12 : y1 - 12, "L"]);
	cand.push([330 + R() * 560, y0 + 16 + R() * (y1 - y0 - 28), "D"]);
	if (R() < 0.6) cand.push([330 + R() * 560, y0 + 16 + R() * (y1 - y0 - 28), "D"]);
	if (A.tod === 2 && R() < 0.7) cand.push([R() < 0.5 ? 180 + R() * 200 : 840 + R() * 200, cy + (R() - 0.5) * hh * 1.6, "L"]);
	for (const [x0, yy, kd] of cand) {
		const list = kd === "B" ? w.big : kd === "S" ? w.small : kd === "L" ? w.light : w.destr,
			spr = list[(R() * list.length) | 0],
			d = propDef(spr);
		if (!d || !ATL.props[spr]) continue;
		const o = { spr, k: spr.split("_")[0], x: clamp(x0, 170, 1050), y: clamp(yy, y0 + d.ry + 2, y1 - 2), rx: d.rx, ry: d.ry, oy: d.oy, hp: d.hp || 0, d, ph: R() * 6, hitT: 0 };
		if (A.obs.some((q) => Math.abs(q.x - o.x) / (q.rx + o.rx + 34) < 1 && Math.abs(q.y - o.y) / (q.ry + o.ry + 30) < 1)) continue;
		A.obs.push(o);
	}
	buildGrid(A);
	// проход между сторонами обязан существовать
	let guard = 0;
	while (!navReach(A, 150, cy, 1070, cy) && A.obs.length && guard++ < 12) {
		A.obs.splice((R() * A.obs.length) | 0, 1);
		buildGrid(A);
	}
	// покрытия
	const np = 2 + ((R() * 3) | 0);
	for (let i = 0; i < np; i++) {
		const k = w.patch[R() < 0.6 ? 0 : 1],
			P = PATCH[k],
			p = { k, P, x: 200 + R() * 820, y: y0 + 24 + R() * (y1 - y0 - 40), rx: 46 + R() * 62, ry: 14 + R() * 14, s: (R() * 1e6) | 0 };
		if ((P.slow || P.haz) && (p.x < 520 ? p.x > 130 && p.x < 500 && R() < 0.6 : false)) continue; // не засоряем зону расстановки
		if (A.patches.some((q) => Math.abs(q.x - p.x) < q.rx + p.rx && Math.abs(q.y - p.y) < q.ry + p.ry)) continue;
		A.patches.push(p);
	}
	// мелкий декор
	const nd = 5 + ((R() * 5) | 0);
	for (let i = 0; i < nd; i++) {
		const spr = w.decor[(R() * w.decor.length) | 0];
		if (!ATL.props[spr]) continue;
		const big = spr.startsWith("fern") || spr.startsWith("shrooms"),
			x = big ? (R() < 0.5 ? 60 + R() * 110 : 1040 + R() * 120) : 120 + R() * 980,
			y = big ? y0 + R() * (y1 - y0 + 10) : y0 + 6 + R() * (y1 - y0);
		if (A.obs.some((q) => Math.abs(q.x - x) < q.rx + 30 && Math.abs(q.y - y) < q.ry + 16)) continue;
		A.dec.push({ spr, x, y, fl: R() < 0.5 });
	}
	// искры на заднем плане (кристаллы, звёзды) — фиксированный набор точек
	A.tw = Array.from({ length: 14 }, () => [R() * W, 20 + R() * (y0 - 60), R() * 6]);
	bakeFloor(A);
	return A;
}
function buildGrid(A) {
	const cols = (A.cols = Math.ceil((FLD.x1 - FLD.x0) / CELL)),
		rows = (A.rows = Math.ceil((FLD.y1 - A.y0) / CELL)),
		g = (A.grid = new Uint8Array(cols * rows));
	for (const o of A.obs) {
		if (o.dead) continue;
		const rx = o.rx + 13,
			ry = o.ry + 10;
		for (let j = 0; j < rows; j++)
			for (let i = 0; i < cols; i++) {
				const dx = (FLD.x0 + (i + 0.5) * CELL - o.x) / rx,
					dy = (A.y0 + (j + 0.5) * CELL - o.y) / ry;
				if (dx * dx + dy * dy < 1) g[j * cols + i] = 1;
			}
	}
	A.gv++;
	A.nf.clear();
}
const cellOf = (A, x, y) => clamp(((y - A.y0) / CELL) | 0, 0, A.rows - 1) * A.cols + clamp(((x - FLD.x0) / CELL) | 0, 0, A.cols - 1);
// поле расстояний до клетки-цели (BFS по 8 соседям, без срезания углов)
function navField(A, tx, ty) {
	const key = cellOf(A, tx, ty);
	let f = A.nf.get(key);
	if (f) return f;
	const cols = A.cols,
		rows = A.rows,
		g = A.grid,
		d = new Int16Array(cols * rows).fill(-1),
		q = new Int32Array(cols * rows);
	let h = 0,
		tl = 0;
	d[key] = 0;
	q[tl++] = key;
	while (h < tl) {
		const c = q[h++],
			cx = c % cols,
			cy = (c / cols) | 0,
			dv = d[c] + 1;
		for (let oy = -1; oy <= 1; oy++)
			for (let ox = -1; ox <= 1; ox++) {
				if (!ox && !oy) continue;
				const nx = cx + ox,
					ny = cy + oy;
				if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
				const n = ny * cols + nx;
				if (d[n] >= 0 || g[n]) continue;
				if (ox && oy && (g[cy * cols + nx] || g[ny * cols + cx])) continue;
				d[n] = dv;
				q[tl++] = n;
			}
	}
	if (A.nf.size > 400) A.nf.clear();
	A.nf.set(key, d);
	return d;
}
function navReach(A, x0, y0, x1, y1) {
	return navField(A, x1, y1)[cellOf(A, x0, y0)] >= 0;
}
function navLos(A, x0, y0, x1, y1) {
	const d = Math.hypot(x1 - x0, y1 - y0),
		n = Math.ceil(d / 7);
	for (let i = 1; i < n; i++) {
		const k = i / n;
		if (A.grid[cellOf(A, x0 + (x1 - x0) * k, y0 + (y1 - y0) * k)]) return false;
	}
	return true;
}
// направление шага к цели с обходом препятствий
function navDir(A, x, y, tx, ty) {
	const dx = tx - x,
		dy = ty - y,
		dl = Math.hypot(dx, dy) || 1;
	if (navLos(A, x, y, tx, ty)) return [dx / dl, dy / dl];
	const f = navField(A, tx, ty),
		cols = A.cols,
		rows = A.rows,
		c = cellOf(A, x, y),
		cx = c % cols,
		cy = (c / cols) | 0;
	let best = -1,
		bd = f[c] >= 0 ? f[c] : 1e9,
		bx = 0,
		by = 0;
	for (let oy = -1; oy <= 1; oy++)
		for (let ox = -1; ox <= 1; ox++) {
			if (!ox && !oy) continue;
			const nx = cx + ox,
				ny = cy + oy;
			if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
			const n = ny * cols + nx;
			if (f[n] < 0 || A.grid[n]) continue;
			if (ox && oy && (A.grid[cy * cols + nx] || A.grid[ny * cols + cx])) continue;
			const v = f[n] + (ox && oy ? 0.4 : 0);
			if (v < bd) {
				bd = v;
				best = n;
				bx = nx;
				by = ny;
			}
		}
	if (best < 0) return [dx / dl, dy / dl];
	const px = FLD.x0 + (bx + 0.5) * CELL - x,
		py = A.y0 + (by + 0.5) * CELL - y,
		pl = Math.hypot(px, py) || 1;
	return [px / pl, py / pl];
}
// вытолкнуть точку из препятствий и вернуть в границы поля
function navPush(A, u, rad) {
	for (const o of A.obs) {
		if (o.dead) continue;
		const rx = o.rx + rad * 0.7,
			ry = o.ry + rad * 0.5,
			dx = (u.x - o.x) / rx,
			dy = (u.y - o.y) / ry,
			d = dx * dx + dy * dy;
		if (d < 1) {
			if (d < 1e-12) {
				// В самой середине препятствия направление не определено: выбираем свободную сторону поля.
				u.x = o.x + (o.x + rx <= FLD.x1 ? rx : -rx);
				u.y = o.y;
			} else {
				const l = Math.sqrt(d);
				u.x = o.x + (dx / l) * rx;
				u.y = o.y + (dy / l) * ry;
			}
		}
	}
	u.x = clamp(u.x, FLD.x0, FLD.x1);
	u.y = clamp(u.y, A.y0, FLD.y1);
}
function surfAt(A, x, y) {
	for (const p of A.patches) {
		const dx = (x - p.x) / (p.rx * 0.9),
			dy = (y - p.y) / (p.ry * 0.9);
		if (dx * dx + dy * dy < 1) return p.P;
	}
	return null;
}
// запечь пол: фон арены + покрытия + тени неподвижных объектов (в арт-пикселях)
function bakeFloor(A) {
	const c = A.floor || (A.floor = mkC(609, 270)),
		x = c.getContext("2d"),
		st = IMG[A.w.stage] || IMG.stage_taiga;
	x.imageSmoothingEnabled = false;
	x.setTransform(1, 0, 0, 1, 0, 0);
	if (A.flip) {
		x.translate(609, 0);
		x.scale(-1, 1);
	}
	x.drawImage(st, 0, 0);
	x.setTransform(1, 0, 0, 1, 0, 0);
	for (const p of A.patches) {
		const cx = p.x / 2,
			cy = p.y / 2,
			rx = p.rx / 2,
			ry = p.ry / 2,
			P = p.P;
		for (let py = Math.floor(cy - ry - 2); py <= cy + ry + 2; py++)
			for (let px = Math.floor(cx - rx - 2); px <= cx + rx + 2; px++) {
				const nx = (px - cx) / rx,
					ny = (py - cy) / ry,
					d = Math.sqrt(nx * nx + ny * ny) + (vnoise(px * 0.3, py * 0.55, p.s) - 0.5) * 0.55;
				if (d >= 1) continue;
				const tone = d < 0.5 ? 0 : d < 0.8 ? 1 : 2;
				if (tone === 2 && (px + py) & 1) continue;
				x.fillStyle = P.c[tone];
				if (P.grid && (px % 9 === 0 || py % 6 === 0)) x.fillStyle = P.c[2];
				else if (P.shine && vnoise(px * 0.12 + py * 0.3, py * 0.8, p.s + 3) > 0.74) x.fillStyle = "#ffffff";
				x.fillRect(px, py, 1, 1);
			}
	}
	x.fillStyle = "rgba(12,8,22,.36)";
	for (const o of A.obs) {
		if (o.dead) continue;
		x.beginPath();
		x.ellipse(o.x / 2 + 3, o.y / 2 + 1, o.rx * 0.62, o.ry * 0.62, 0, 0, TAU);
		x.fill();
	}
	for (const d of A.dec) {
		const r = ATL.props[d.spr];
		x.beginPath();
		x.ellipse(d.x / 2 + 1, d.y / 2, r[2] * 0.42, Math.max(1.5, r[2] * 0.12), 0, 0, TAU);
		x.fill();
	}
}
// разрушение объекта: обломки, звук, проход открывается
function breakProp(A, o) {
	if (o.dead || !o.hp) return;
	o.dead = true;
	burst(o.x, o.y - 16, 16, { c: o.d.deb || ["#8a8a8a"], sp: 190, s: 6, sv: 0.8, life: 0.7, up: 90, fl: o.y + 4, bn: 0.4 });
	burst(o.x, o.y - 10, 6, { c: "rgba(120,110,100,.5)", k: 5, s: 9, e: 2.2, g: -20, sp: 40, life: 0.6 });
	ring(o.x, o.y, 54, "#fff3d0", 0.3, 4);
	sfx("crack");
	buildGrid(A);
	bakeFloor(A);
}

// ---------- погода и атмосфера ----------
const EMIT = {
	leaf: [7, () => ({ x: rr(0, W + 260), y: -10, vx: rr(-70, -25), vy: rr(34, 66), wob: 46, wf: rr(2, 4), ph: rr(0, 6), life: 10, c: pick(["#d98a3a", "#b5652a", "#e0b040", "#8a9a3a"]), s: 6, k: 4, vr: rr(3, 7), l: 2, fl: rr(240, 540), fade: 0 })],
	needle: [5, () => ({ x: rr(0, W + 260), y: -10, vx: rr(-60, -20), vy: rr(30, 60), wob: 40, wf: rr(2, 4), ph: rr(0, 6), life: 10, c: pick(["#2e7d32", "#388e3c", "#1b5e20", "#43a047", "#33691e"]), s: 2, k: 2, len: 0.12, l: 2, fl: rr(230, 560), fade: 0 })],
	fly: [2.2, () => ({ x: rr(0, W), y: rr(150, 450), vx: rr(-14, 14), vy: rr(-10, 10), wob: 30, wf: rr(1, 3), ph: rr(0, 6), life: rr(3, 6), c: "#f6f08a", s: 5, k: 1, l: 2, fi: 0.2 })],
	rain: [150, () => ({ x: rr(-100, W + 200), y: -20, vx: -190, vy: 840, life: 0.75, c: "rgba(170,200,255,.55)", s: 2, k: 2, len: 0.028, l: 2, fl: rr(230, 560), fade: 0 })],
	snow: [34, () => ({ x: rr(-50, W + 150), y: -8, vx: rr(-34, -6), vy: rr(38, 78), wob: 30, wf: rr(1.5, 3.5), ph: rr(0, 6), life: 12, c: "#ffffff", s: pick([2, 4, 4]), k: 0, l: 2, fl: rr(230, 560), fade: 0 })],
	bliz: [120, () => ({ x: W + 20, y: rr(-40, H), vx: rr(-620, -420), vy: rr(60, 150), life: 3, c: "#ffffff", s: pick([2, 4]), k: 2, len: 0.016, l: 2, fade: 0, a: 0.8 })],
	sand: [110, () => ({ x: -20, y: rr(60, H), vx: rr(460, 680), vy: rr(-20, 40), life: 3, c: pick(["rgba(235,205,140,.6)", "rgba(210,170,100,.5)"]), s: 2, k: 2, len: 0.03, l: 2, fade: 0 })],
	dust: [3, () => ({ x: rr(0, W), y: rr(200, 440), vx: rr(10, 34), vy: rr(-8, 4), life: rr(3, 5), c: "rgba(255,240,200,.5)", s: 2, k: 0, l: 2, fi: 0.3 })],
	ash: [16, () => ({ x: rr(0, W + 100), y: -8, vx: rr(-24, 8), vy: rr(26, 54), wob: 24, wf: 2, ph: rr(0, 6), life: 12, c: pick(["#4a4448", "#6a6468", "#2e2a2e"]), s: pick([2, 4]), k: 4, vr: 3, l: 2, fl: rr(230, 560), fade: 0 })],
	ember: [9, () => ({ x: rr(0, W), y: rr(260, 540), vx: rr(-16, 16), vy: rr(-80, -34), wob: 26, wf: 3, ph: rr(0, 6), life: rr(2, 4), c: pick(["#ffb03c", "#ff7a2c", "#ffe27a"]), s: 3, k: 1, l: 2 })],
	spore: [7, () => ({ x: rr(0, W), y: rr(180, 520), vx: rr(-10, 10), vy: rr(-22, -6), wob: 22, wf: 2, ph: rr(0, 6), life: rr(3, 6), c: pick(["#b8ff5e", "#7af0c0"]), s: 4, k: 1, l: 2, fi: 0.25 })],
	wind: [7, () => ({ x: -60, y: rr(120, 460), vx: rr(700, 980), vy: rr(-10, 10), life: 2, c: "rgba(255,255,255,.35)", s: 2, k: 2, len: 0.08, l: 2, fade: 0 })],
	wisp: [4, () => ({ x: rr(0, W), y: rr(260, 500), vx: rr(-8, 8), vy: rr(-44, -18), wob: 34, wf: 2.4, ph: rr(0, 6), life: rr(3, 5), c: pick(["#8effa0", "#b0ffe0"]), s: 7, k: 1, l: 2, fi: 0.2 })],
	spark: [9, () => ({ x: rr(0, W), y: rr(40, 500), life: rr(0.3, 0.7), c: pick(["#ffffff", "#b0f4ff", "#ff9cf0"]), s: pick([2, 4]), k: 0, l: 2, fi: 0.4 })],
	glit: [7, () => ({ x: rr(0, W), y: rr(60, 500), vx: rr(-30, 30), vy: rr(-30, 30), life: rr(0.5, 1.6), c: pick(["#ff4fd8", "#5ff0e0", "#ffffff", "#8a4fff"]), s: pick([4, 6, 8]), k: 0, l: 2, fi: 0.2 })],
	mote: [8, () => ({ x: rr(0, W), y: rr(240, 540), vx: rr(-6, 6), vy: rr(-40, -14), wob: 14, wf: 2, ph: rr(0, 6), life: rr(3, 6), c: pick(["#ffe9a8", "#c0f0ff"]), s: 4, k: 1, l: 2, fi: 0.2 })],
	cloud: [0.5, () => ({ x: W + 160, y: rr(250, 420), vx: rr(-46, -26), life: 40, c: "rgba(20,30,60,.13)", s: rr(70, 130), k: 5, l: 0, fade: 0 })],
	bubl: [3, () => ({ x: rr(100, W - 100), y: rr(260, 430), vy: -12, life: rr(0.6, 1.2), c: "rgba(160,255,140,.5)", s: 3, k: 3, r0: 2, r1: 9, w: 2, fy: 0.6, l: 0 })],
};
// фоновая атмосфера мира + добавка от погоды
const AMBI = { taiga: ["fly"], desert: ["dust"], ice: ["spark"], fire: ["ember"], swamp: ["spore", "bubl"], sky: ["cloud", "dust"], dead: ["wisp"], crystal: ["spark"], chaos: ["glit"], final: ["mote"] };
const WXEM = { leaves: ["leaf"], needles: ["needle"], rain: ["rain"], storm: ["rain"], sandstorm: ["sand"], heat: ["dust"], snow: ["snow"], blizzard: ["bliz", "snow"], ash: ["ash"], eruption: ["ash", "ember"], spores: ["spore", "spore"], wind: ["wind"], wisps: ["wisp", "wisp"], sparkle: ["spark"], resonance: ["spark", "spark"], flux: ["glit"], glitch: ["glit", "glit"], motes: ["mote"], eclipse: ["mote"] };
const WXTINT = { rain: ["#203860", 0.14], storm: ["#182848", 0.22], sandstorm: ["#c8a060", 0.18], blizzard: ["#e8f4ff", 0.14], eruption: ["#601808", 0.12], eclipse: ["#280838", 0.24], heat: ["#ffd890", 0.06], fog: ["#c8d8d8", 0.05] };
function wxEmit(A, dt, scale = 1) {
	const ids = (AMBI[A.w.id] || []).concat(WXEM[A.wx] || []),
		q = [0.4, 0.7, 1][QL.lv] * scale;
	for (const id of ids) {
		const e = EMIT[id];
		let acc = (A.em[id] || 0) + e[0] * dt * q;
		while (acc >= 1) {
			acc -= 1;
			Parts.add(e[1]());
		}
		A.em[id] = acc;
	}
}
// «живые» детали фона — у каждого мира свои
function stageFx(A) {
	const id = A.w.id,
		y0 = A.y0,
		fog = fogSpr();
	if (id === "taiga" || id === "swamp" || id === "dead" || A.wx === "fog") {
		const al = (A.wx === "fog" ? 0.55 : 0.3) * (id === "taiga" ? 0.8 : 1);
		ctx.globalAlpha = al;
		for (let i = 0; i < 2; i++) {
			const sp = i ? 14 : -9,
				ox = (((t * sp) % 1024) + 1024) % 1024;
			ctx.drawImage(fog, ox - 1024, y0 - 130 + i * 26, 1024, 150);
			ctx.drawImage(fog, ox, y0 - 130 + i * 26, 1024, 150);
			ctx.drawImage(fog, ox + 1024, y0 - 130 + i * 26, 1024, 150);
		}
		ctx.globalAlpha = 1;
		if (id !== "taiga") glow(609, y0 - 40, 520, id === "swamp" ? "#3c8a50" : "#58a870", 0.1 + 0.04 * Math.sin(t * 0.7));
	}
	if (id === "taiga" && A.tod === 0) {
		// косые лучи заката
		ctx.save();
		ctx.globalCompositeOperation = "lighter";
		for (let i = 0; i < 4; i++) {
			const x = 180 + i * 250 + Math.sin(t * 0.3 + i) * 20;
			ctx.globalAlpha = 0.05 + 0.025 * Math.sin(t * 0.8 + i * 2);
			ctx.fillStyle = "#ffd9a0";
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.lineTo(x + 70, 0);
			ctx.lineTo(x - 130, y0 + 60);
			ctx.lineTo(x - 260, y0 + 60);
			ctx.fill();
		}
		ctx.restore();
	} else if (id === "desert") glow(A.flip ? 600 : 618, 96, 230, "#fff0b0", 0.16 + 0.05 * Math.sin(t * 1.3));
	else if (id === "ice") for (let i = 0; i < 4; i++) glow(200 + i * 270 + Math.sin(t * 0.4 + i * 1.7) * 90, 60 + Math.sin(t * 0.6 + i) * 14, 170, i & 1 ? "#a070ff" : "#50ffb0", 0.1 + 0.06 * Math.sin(t * 0.9 + i * 2.1));
	else if (id === "fire") {
		glow(609, y0 - 30, 620, "#ff5a1c", 0.1 + 0.05 * Math.sin(t * 2.1));
		glow(609, 380, 560, "#ff8a3c", 0.04 + 0.03 * Math.sin(t * 3.3));
	} else if (id === "crystal") {
		for (const s of A.tw) {
			const a = Math.max(0, Math.sin(t * 2.2 + s[2]));
			if (a > 0.5) glow(s[0], s[1], 26 * a, s[2] > 3 ? "#ff9cf0" : "#9cf0ff", a * 0.5);
		}
	} else if (id === "chaos") {
		ctx.save();
		ctx.globalCompositeOperation = "hue";
		ctx.globalAlpha = 0.55;
		ctx.fillStyle = `hsl(${(t * 26) % 360},90%,50%)`;
		ctx.fillRect(0, 0, W, H);
		ctx.restore();
		for (let i = 0; i < 3; i++) glow(240 + i * 370 + Math.sin(t * 0.5 + i) * 60, 90 + Math.cos(t * 0.7 + i) * 30, 120, i & 1 ? "#ff4fd8" : "#5ff0e0", 0.16);
	} else if (id === "final") {
		const a = 0.12 + 0.06 * Math.sin(t * 1.1);
		ctx.save();
		ctx.globalCompositeOperation = "lighter";
		const g = ctx.createLinearGradient(0, 0, 0, y0 + 40);
		g.addColorStop(0, "rgba(190,230,255," + a * 2 + ")");
		g.addColorStop(1, "rgba(190,230,255,0)");
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.moveTo(569, 0);
		ctx.lineTo(649, 0);
		ctx.lineTo(719, y0 + 40);
		ctx.lineTo(499, y0 + 40);
		ctx.fill();
		ctx.restore();
		ctx.strokeStyle = "rgba(255,214,120," + (0.25 + 0.2 * Math.sin(t * 1.6)) + ")";
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.ellipse(609, (y0 + FLD.y1) / 2 + 10, 250, 78, 0, 0, TAU);
		ctx.stroke();
	} else if (id === "sky") glow(609, 60, 420, "#ffffff", 0.08);
	// светящиеся покрытия и лужи
	for (const p of A.patches) if (p.P.glow) glow(p.x, p.y, p.rx * 1.3, p.P.glow, 0.2 + 0.1 * Math.sin(t * 3 + p.s));
}
// зной: дрожащий воздух над горизонтом
function heatHaze(A) {
	if (A.wx !== "heat" || QL.lv === 0) return;
	const y0 = A.y0 - 70;
	for (let i = 0; i < 12; i++) {
		const sy = (y0 + i * 6) >> 1,
			ox = Math.round(Math.sin(t * 4 + i * 0.9) * 1.5) * 2;
		ctx.drawImage(A.floor, 0, sy, 609, 3, ox, sy * 2, W, 6);
	}
}
function wxTint(A) {
	const q = WXTINT[A.wx];
	if (q) {
		ctx.globalAlpha = q[1] * (A.wx === "blizzard" ? 0.7 + 0.3 * Math.sin(t * 2) : 1);
		ctx.fillStyle = q[0];
		ctx.fillRect(0, 0, W, H);
		ctx.globalAlpha = 1;
	}
	if (A.wx === "fog" && QL.lv > 0) {
		const fog = fogSpr(),
			ox = (((t * 22) % 1024) + 1024) % 1024;
		ctx.globalAlpha = 0.22;
		ctx.drawImage(fog, ox - 1024, 250, 1024, 220);
		ctx.drawImage(fog, ox, 250, 1024, 220);
		ctx.drawImage(fog, ox + 1024, 250, 1024, 220);
		ctx.globalAlpha = 1;
	}
	if (A.fl > 0) {
		// вспышка молнии
		ctx.globalAlpha = Math.min(0.5, A.fl * 2.5);
		ctx.fillStyle = "#dfe8ff";
		ctx.fillRect(0, 0, W, H);
		ctx.globalAlpha = 1;
	}
}
// пиксельное пламя (костёр, жаровня): языки из квадратов, порядок отрисовки — вместе с объектом
function flame(x, y, sc, cols, ph = 0) {
	for (let i = 0; i < 11; i++) {
		const p = (t * 1.5 + i * 0.37 + ph) % 1,
			px = x + Math.sin(i * 12.9 + ph) * 13 * sc * (1 - p * 0.7) + Math.sin(t * 9 + i) * 2,
			py = y - p * 46 * sc,
			s = Math.max(2, Math.round(((1 - p) * 11 * sc + 2) / 2) * 2);
		ctx.fillStyle = cols[p < 0.22 ? 0 : p < 0.5 ? 1 : p < 0.78 ? 2 : 3];
		ctx.fillRect(Math.round((px - s / 2) / 2) * 2, Math.round((py - s / 2) / 2) * 2, s, s);
	}
}
function drawProp(A, o) {
	const img = propImg(A.w),
		wob = o.hitT > 0 ? Math.sin(o.hitT * 60) * 3 * (o.hitT / 0.25) : 0;
	// объект, заслонивший бойца, становится полупрозрачным
	o.fa = o.fa === undefined ? 1 : o.fa + ((o.occ ? 0.42 : 1) - o.fa) * Math.min(1, DT * 10 + 0.02);
	ctx.globalAlpha = o.fa;
	if (o.d.fire) drawCampfire(o.x + wob, o.y + o.oy, AP, o.ph || 0);
	else ub("props", o.spr, o.x + wob, o.y + o.oy, AP, img);
	ctx.globalAlpha = 1;
	const d = o.d;
	if (d.fire) {
		// Пламя и искры уже покадрово нарисованы в растровом атласе.
	} else if (d.glow) {
		const gx = o.x + (d.lx || 0),
			gy = o.y + (d.ly || 0) + o.oy;
		glow(gx, gy + (o.k === "lantern" ? 0 : 14), o.k === "lantern" ? 22 : 34, o.k === "shrooms" && A.w.pt ? A.w.ui : d.glow, 0.42 + 0.14 * Math.sin(t * 2.4 + o.ph));
	}
}
function arenaLights(A) {
	for (const o of A.obs) {
		if (o.dead || !o.d.glow) continue;
		const d = o.d,
			fl = d.fire ? 0.86 + 0.14 * Math.sin(t * 12 + o.ph) * Math.sin(t * 7.3) : 0.92 + 0.08 * Math.sin(t * 2.4 + o.ph),
			col = d.fire ? (A.w.fire || FIRE0)[1] : o.k === "shrooms" && A.w.pt ? A.w.ui : d.glow;
		Light.add(o.x + (d.lx || 0), o.y + (d.ly || 0) + o.oy * 0.5, d.lr * fl, col, 0.95);
	}
	for (const p of A.patches) if (p.P.glow) Light.add(p.x, p.y, p.rx * 2.2, p.P.glow, 0.6);
	for (const p of A.pools) Light.add(p.x, p.y, p.r * 2.4, EL[p.el].c, 0.6);
}

