// ===== 60_game.js =====
// ===== ХОД ИГРЫ: миры, карта, события и награды, магазин, арена-режим, сохранения =====
let EV = null, // текущее событие (награда, находка, выбор реликвии)
	MV = null, // переход отряда по карте
	MAPC = null, // запечённый фон карты
	MAPK = null, // ключ запечённого фона: сид+мир
	MAPL = [], // озёра на карте (для бликов)
	MAPJ = null, // незавершённая запечка фона карты (см. bakeMap/bakeStep)
	TIPN = null;
const cmul = () => 1 + 0.5 * (G.w || 0); // доход растёт с номером мира
const luck = () => (G.w || 0) * 0.7;

// ---------- карта мира ----------
// ---------- карта: слои узлов → рёбра → раздвижка → типы узлов → смежность ----------
// Порядок вызовов Rand.next() сохранён в точности (эталон 500 карт).
function genMap() {
	const R = Rand.next,
		L = 6 + ((R() * 3) | 0),
		sx = 84 + R() * 30,
		ex = 1118,
		gp = (ex - sx) / (L + 1);
	const ly = mapLayers(R, L, sx, ex, gp);
	mapEdges(R, ly);
	mapSpread();
	E.forEach((e) => (e[2] = 0));
	mapKinds(R);
	ADJ = N.map(() => []);
	E.forEach(([a, b]) => {
		ADJ[a].push(b);
		ADJ[b].push(a);
	});
}
// узлы по слоям: старт, L промежуточных слоёв по 1–4 узла, босс
function mapLayers(R, L, sx, ex, gp) {
	N = [{ x: sx, y: 200 + R() * 110, ly: 0 }];
	E = [];
	const ly = [[0]];
	for (let l = 1; l <= L; l++) {
		const r = R(),
			c = l === 1 ? 2 + (R() < 0.5 ? 1 : 0) : r < 0.12 ? 1 : r < 0.55 ? 2 : r < 0.92 ? 3 : 4,
			ids = [];
		for (let k = 0; k < c; k++) {
			N.push({ x: sx + gp * l + (R() - 0.5) * gp * 0.3, y: 128 + (k + 0.5) * (256 / c) + (R() - 0.5) * (c > 3 ? 12 : 40), ly: l });
			ids.push(N.length - 1);
		}
		ly.push(ids);
	}
	N.push({ x: ex, y: 200 + R() * 100, k: "boss", ly: L + 1 });
	ly.push([N.length - 1]);
	return ly;
}
// рёбра: каждый узел связан с ближайшим по высоте соседом, плюс случайная развилка
function mapEdges(R, ly) {
	for (let l = 0; l < ly.length - 1; l++) {
		const A = ly[l],
			Bl = ly[l + 1];
		Bl.forEach((b) => {
			const a = A.slice().sort((p, q) => Math.abs(N[p].y - N[b].y) - Math.abs(N[q].y - N[b].y))[0];
			E.push([a, b]);
		});
		A.forEach((a) => {
			if (!E.some((e) => e[0] === a)) {
				const b = Bl.slice().sort((p, q) => Math.abs(N[p].y - N[a].y) - Math.abs(N[q].y - N[a].y))[0];
				E.push([a, b]);
			}
		});
		if (A.length > 1 && Bl.length > 1 && R() < 0.5) {
			const a = A[(R() * A.length) | 0],
				b = Bl.slice().sort((p, q) => Math.abs(N[p].y - N[a].y) - Math.abs(N[q].y - N[a].y))[1];
			if (b !== undefined && !E.some((e) => e[0] === a && e[1] === b)) E.push([a, b]);
		}
	}
}
// значки не налезают друг на друга: раздвигаем по вертикали
function mapSpread() {
	for (let it = 0; it < 40; it++)
		for (let i = 1; i < N.length; i++)
			for (let j = i + 1; j < N.length; j++) {
				const a = N[i],
					b = N[j],
					dx = b.x - a.x,
					dy = b.y - a.y,
					d = Math.hypot(dx, dy * 0.9);
				if (d < 76) {
					const p = (76 - d) / 2,
						s = dy >= 0 ? 1 : -1;
					a.y = clamp(a.y - s * p, 126, 386);
					b.y = clamp(b.y + s * p, 126, 386);
				}
			}
}
// типы узлов: события и элитные бои раскладываются по свободным узлам
function mapKinds(R) {
	const free = N.map((_, i) => i)
			.filter((i) => i > 0 && N[i].k !== "boss")
			.sort(() => R() - 0.5),
		ks = ["tribe", "tribe", "chest", "arena", "barr", "mine", "swamp"],
		cnt = Math.max(7, Math.round((N.length - 2) * 0.42));
	while (ks.length < cnt) ks.push(["mine", "barr", "swamp", "tribe", "chest"][(R() * 5) | 0]);
	// элитные бои — не в начале пути: первые шаги должны быть по силам стартовому бойцу
	ks.forEach((k) => {
		const j = free.findIndex((i) => (k !== "arena" || N[i].ly >= 3) && (k !== "swamp" || N[i].ly >= 2) && (k !== "chest" || N[i].ly >= 2));
		if (j >= 0) N[free.splice(j, 1)[0]].k = k;
	});
	if (free.length && R() < 0.65) N[free[(R() * free.length) | 0]].k = "secret";
	if (!N.some((n) => n.k === "tribe" && n.ly <= 2)) {
		const c = N.filter((n) => n.ly > 0 && n.ly <= 2 && !n.k);
		(c[0] || N.find((n) => n.ly === 1)).k = "tribe";
	}
}
// палитры карты для каждого мира: земля, дорога, доля леса, перекраска деревьев и воды
const MAPT = {
	taiga: { g: ["#3c6a3c", "#335e35", "#477a44"], road: ["#c9a56e", "#7a5c3a"], dens: 0.55, tr: 0.8 },
	desert: { g: ["#d9b36c", "#cba45c", "#e6c482"], road: ["#f6e6ba", "#a8824c"], dens: 0.22, tr: 0.2, tint: [{ h: [70, 178], to: 56, sat: 0.6, val: 1.02 }] },
	ice: {
		g: ["#dcecf8", "#c6dcf0", "#f2f9ff"],
		road: ["#9db4d6", "#6880aa"],
		dens: 0.42,
		tr: 0.7,
		tint: [
			{ h: [70, 165], to: 186, sat: 0.32, val: 1.3 },
			{ h: [165, 235], to: 202, sat: 0.45, val: 1.35 },
		],
	},
	fire: {
		g: ["#4a3236", "#3e282e", "#5c3c3c"],
		road: ["#9a6a52", "#2a181c"],
		dens: 0.25,
		tr: 0.35,
		tint: [
			{ h: [70, 165], to: 14, sat: 0.6, val: 0.62 },
			{ h: [165, 235], to: 22, sat: 1.4, val: 1.5 },
			{ h: [30, 70], to: 14, sat: 0.6, val: 0.5 },
		],
	},
	swamp: {
		g: ["#2f4a3a", "#273f33", "#3b5a45"],
		road: ["#8a8a5a", "#34382a"],
		dens: 0.6,
		tr: 0.6,
		tint: [
			{ h: [70, 165], to: 138, sat: 0.7, val: 0.72 },
			{ h: [165, 235], to: 104, sat: 0.8, val: 0.7 },
		],
	},
	sky: {
		g: ["#9fd09a", "#8cc08a", "#b4dea8"],
		road: ["#fff6da", "#a89a78"],
		dens: 0.3,
		tr: 0.5,
		tint: [
			{ h: [70, 165], to: 110, sat: 0.7, val: 1.2 },
			{ h: [165, 235], to: 205, sat: 0.4, val: 1.5 },
		],
	},
	dead: {
		g: ["#5c5a52", "#4e4c46", "#6a685e"],
		road: ["#b8b4a0", "#38362e"],
		dens: 0.35,
		tr: 0.5,
		tint: [
			{ h: [70, 165], to: 66, sat: 0.22, val: 0.62 },
			{ h: [165, 235], to: 120, sat: 0.5, val: 0.8 },
		],
	},
	crystal: {
		g: ["#3a2a5a", "#30224e", "#4a3670"],
		road: ["#c8a8ff", "#1e1438"],
		dens: 0.35,
		tr: 0.6,
		tint: [
			{ h: [70, 165], to: 285, sat: 0.8, val: 1.15 },
			{ h: [165, 235], to: 185, sat: 1, val: 1.4 },
		],
	},
	chaos: {
		g: ["#3a1a4a", "#2e1240", "#4c2460"],
		road: ["#ff9cf0", "#1c0a28"],
		dens: 0.3,
		tr: 0.5,
		tint: [
			{ h: [70, 165], to: 176, sat: 1.1, val: 1.1 },
			{ h: [165, 235], to: 310, sat: 1.1, val: 1.2 },
		],
	},
	final: {
		g: ["#2a3050", "#222844", "#343c64"],
		road: ["#ffe9a8", "#141a30"],
		dens: 0.3,
		tr: 0.5,
		tint: [
			{ h: [70, 165], to: 228, sat: 0.5, val: 0.8 },
			{ h: [165, 235], to: 46, sat: 0.9, val: 1.4 },
		],
	},
};
const hex3 = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function mapImg(w) {
	const P = MAPT[w.id];
	if (!P.tint) return IMG.map;
	return TINTC.get("map" + w.i) || TINTC.set("map" + w.i, recolor(IMG.map, P.tint));
}
function segD(px, py, ax, ay, bx, by) {
	const dx = bx - ax,
		dy = by - ay,
		l = dx * dx + dy * dy || 1,
		k = clamp(((px - ax) * dx + (py - ay) * dy) / l, 0, 1);
	return Math.hypot(px - ax - dx * k, py - ay - dy * k);
}
// Фон карты зависит только от сида и мира, собирается ~0,9 с (на телефоне в разы дольше).
// Раньше это был один синхронный вызов — экран замирал при каждом входе в мир и при загрузке
// сохранения. Теперь bakeMap только заводит работу MAPJ, а bakeStep() из цикла кадра выполняет
// её порциями по BAKE_MS миллисекунд: игра продолжает рисовать кадры, экран карты показывает
// полосу прогресса (dMapLoading), а по готовности MAPK = ключ и карта появляется.
// Результат побайтово тот же, что у синхронной версии: порядок обхода пикселей и обращений
// к rng32 не изменился (проверяется контрольной суммой в tests/unit/map.test.mjs).
// бюджет одной порции; обвязка тестов задаёт __mxBakeMs (по умолчанию там — всё за один кадр,
// чтобы снимки и golden не зависели от скорости машины)
const BAKE_MS = typeof __mxBakeMs === "number" ? __mxBakeMs : 9;
function bakeMap(seed) {
	const wi = G ? G.w || 0 : 0,
		key = seed + ":" + wi;
	SD = seed;
	if (MAPC && MAPK === key && !MAPJ) return; // уже готово
	if (MAPJ && MAPJ.key === key) return; // уже собирается
	const w = WORLDS[wi],
		P = MAPT[w.id],
		c = MAPC || (MAPC = mkC(609, 270)),
		x = c.getContext("2d");
	x.imageSmoothingEnabled = false;
	MAPK = null;
	MAPL = [];
	MAPJ = {
		seed,
		key,
		w,
		P,
		x,
		im: mapImg(w),
		AM: ATL.map,
		R: rng32(seed),
		R2: rng32(seed + 5),
		id: x.createImageData(609, 270),
		cols: P.g.map(hex3),
		py: 0, // следующая строка земли
		stage: 0, // 0 — земля, 1 — озёра/дороги/лес
		t0: t, // когда начали: полоса прогресса показывается, только если сборка затянулась
	};
}
// земля: пятна трёх тонов по шуму, границы — шахматным дизерингом; строки [y0, y1).
// Шум — тот же vnoise (две октавы), но развёрнутый вручную: углы решётки считаются один раз
// на участок строки, а не на каждый пиксель (в 5 раз быстрее). Формулы и порядок операций с
// плавающей точкой повторяют vnoise дословно, поэтому пиксели совпадают бит-в-бит
// (контрольные суммы — в tests/unit/map.test.mjs).
function bakeGround(J, y0, y1) {
	const p = J.id.data,
		cols = J.cols,
		R2 = J.R2,
		s1 = J.seed,
		s2 = J.seed + 1;
	for (let py = y0; py < y1; py++) {
		const ya = py * 0.034,
			yi1 = Math.floor(ya),
			fy1 = ya - yi1,
			v1 = fy1 * fy1 * (3 - 2 * fy1),
			yb = py * 0.11,
			yi2 = Math.floor(yb),
			fy2 = yb - yi2,
			v2 = fy2 * fy2 * (3 - 2 * fy2);
		let cx1 = -1,
			a1 = 0,
			b1 = 0,
			c1 = 0,
			d1 = 0,
			cx2 = -1,
			a2 = 0,
			b2 = 0,
			c2 = 0,
			d2 = 0;
		for (let px = 0; px < 609; px++) {
			const xa = px * 0.021,
				xi1 = Math.floor(xa),
				fx1 = xa - xi1;
			if (xi1 !== cx1) {
				cx1 = xi1;
				a1 = vhash(xi1, yi1, s1);
				b1 = vhash(xi1 + 1, yi1, s1);
				c1 = vhash(xi1, yi1 + 1, s1);
				d1 = vhash(xi1 + 1, yi1 + 1, s1);
			}
			const u1 = fx1 * fx1 * (3 - 2 * fx1),
				n1 = a1 + (b1 - a1) * u1 + (c1 - a1) * v1 + (a1 - b1 - c1 + d1) * u1 * v1,
				xb = px * 0.08,
				xi2 = Math.floor(xb),
				fx2 = xb - xi2;
			if (xi2 !== cx2) {
				cx2 = xi2;
				a2 = vhash(xi2, yi2, s2);
				b2 = vhash(xi2 + 1, yi2, s2);
				c2 = vhash(xi2, yi2 + 1, s2);
				d2 = vhash(xi2 + 1, yi2 + 1, s2);
			}
			const u2 = fx2 * fx2 * (3 - 2 * fx2),
				n2 = a2 + (b2 - a2) * u2 + (c2 - a2) * v2 + (a2 - b2 - c2 + d2) * u2 * v2,
				n = n1 * 0.7 + n2 * 0.3;
			let tn = n < 0.46 ? 0 : n < 0.6 ? 1 : 2;
			if ((n > 0.44 && n < 0.46) || (n > 0.58 && n < 0.6)) tn = (px + py) & 1 ? tn : n < 0.5 ? 1 : 2;
			let cc = cols[tn];
			const sp = R2();
			if (sp < 0.014) cc = cols[(tn + 1) % 3];
			const i = (py * 609 + px) * 4,
				sh = sp > 0.985 ? 0.9 : 1;
			p[i] = cc[0] * sh;
			p[i + 1] = cc[1] * sh;
			p[i + 2] = cc[2] * sh;
			p[i + 3] = 255;
		}
	}
}
// озёра, дороги, площадки под значками, лес и мелочи — поверх готовой земли
function bakeDecor(J) {
	const { x, im, AM, R, P, seed } = J;
	x.putImageData(J.id, 0, 0);
	const nodes = N.map((n) => [n.x / 2, n.y / 2]),
		edges = E.map(([a, b]) => [nodes[a][0], nodes[a][1], nodes[b][0], nodes[b][1]]),
		roadD = (px, py) => {
			let d = 1e9;
			for (const e of edges) d = Math.min(d, segD(px, py, e[0], e[1], e[2], e[3]));
			return d;
		},
		nodeD = (px, py) => {
			let d = 1e9;
			for (const n of nodes) d = Math.min(d, Math.hypot(px - n[0], (py - n[1]) * 1.3));
			return d;
		};
	// озёра
	MAPL = [];
	const nl = 1 + ((R() * 2) | 0);
	for (let i = 0, tr = 0; i < nl && tr < 60; tr++) {
		const nm = "LK" + ((R() * 3) | 0),
			r = AM[nm],
			lx = 40 + R() * (529 - r[2]),
			ly2 = 56 + R() * (150 - r[3]);
		let ok = true;
		for (let sy = 0; sy <= 4 && ok; sy++) for (let sx = 0; sx <= 6 && ok; sx++) if (roadD(lx + (r[2] * sx) / 6, ly2 + (r[3] * sy) / 4) < 9 || nodeD(lx + (r[2] * sx) / 6, ly2 + (r[3] * sy) / 4) < 18) ok = false;
		if (MAPL.some((q) => Math.abs(q[0] - lx) < 110 && Math.abs(q[1] - ly2) < 60)) ok = false;
		if (!ok) continue;
		x.drawImage(im, r[0], r[1], r[2], r[3], Math.round(lx), Math.round(ly2), r[2], r[3]);
		MAPL.push([lx, ly2, r[2], r[3]]);
		i++;
	}
	// дороги: тёмная кайма + светлая середина, по пикселям
	for (let pass = 0; pass < 2; pass++) {
		x.fillStyle = P.road[pass ? 0 : 1];
		for (const e of edges) {
			const l = Math.hypot(e[2] - e[0], e[3] - e[1]);
			for (let s = 0; s <= l; s += 1) {
				const px = Math.round(e[0] + ((e[2] - e[0]) * s) / l),
					py = Math.round(e[1] + ((e[3] - e[1]) * s) / l);
				if (pass) {
					if (((s / 4) | 0) % 3 !== 2) x.fillRect(px - 1, py - 1, 3, 2);
				} else x.fillRect(px - 2, py - 2, 5, 4);
			}
		}
	}
	// площадки под значками
	for (const n of nodes) {
		x.fillStyle = P.road[1];
		x.beginPath();
		x.ellipse(n[0], n[1] + 3, 15, 9, 0, 0, TAU);
		x.fill();
		x.fillStyle = P.road[0];
		x.beginPath();
		x.ellipse(n[0], n[1] + 3, 13, 7, 0, 0, TAU);
		x.fill();
	}
	// лес и мелочи: рощи по шуму, поляны вокруг дорог
	const items = [];
	for (let i = 0; i < 900; i++) {
		const px = -8 + R() * 625,
			py = 22 + R() * 252,
			dn = vnoise(px * 0.013, py * 0.02, seed + 9),
			rd = roadD(px, py - 3),
			nd = nodeD(px, py - 4),
			grove = dn > 1 - P.dens;
		if (rd < 8 || nd < 19) continue;
		if (MAPL.some((q) => px > q[0] - 6 && px < q[0] + q[2] + 6 && py > q[1] - 2 && py < q[1] + q[3] + 12)) continue;
		let nm;
		const r = R();
		if (grove && r < P.tr) nm = (rd > 16 && R() < 0.5 ? "T3" : R() < 0.6 ? "T2" : "T1") + ((R() * 6) | 0);
		else if (r < (grove ? 1 : 0.16)) nm = "DC" + ((R() * 27) | 0);
		else continue;
		const q = AM[nm];
		if (items.some((o) => Math.abs(o.x - px) < (o.w + q[2]) * 0.36 && Math.abs(o.y - py) < 5)) continue;
		items.push({ x: px, y: py, nm, w: q[2] });
	}
	items.sort((a, b) => a.y - b.y);
	for (const o of items) {
		const q = AM[o.nm];
		x.fillStyle = "rgba(10,8,20,.28)";
		x.beginPath();
		x.ellipse(o.x + 1, o.y - 1, q[2] * 0.42, Math.max(2, q[2] * 0.14), 0, 0, TAU);
		x.fill();
		x.drawImage(im, q[0], q[1], q[2], q[3], Math.round(o.x - q[2] / 2), Math.round(o.y - q[3]), q[2], q[3]);
	}
}
// порция работы: не дольше ms миллисекунд (земля — по строкам), затем декор одним куском.
// Возвращает true, когда карта готова.
function bakeStep(ms) {
	const J = MAPJ;
	if (!J) return true;
	const t0 = performance.now();
	while (J.py < 270) {
		const y1 = Math.min(270, J.py + 6);
		bakeGround(J, J.py, y1);
		J.py = y1;
		if (performance.now() - t0 >= ms) return false;
	}
	J.stage = 1;
	bakeDecor(J);
	MAPK = J.key;
	MAPJ = null;
	return true;
}
// доля готовности для полосы прогресса (декор — последние ~7 %)
const bakeProgress = () => (MAPJ ? Math.min(0.93, (MAPJ.py / 270) * 0.93) : 1);
// дождаться готовности синхронно (тесты, снимки, экспорт)
function bakeNow() {
	while (MAPJ) bakeStep(1e9);
}
function avail() {
	const a = ADJ[G.cur].filter((n) => !G.vis.has(n) && N[n].x > N[G.cur].x);
	return a.length ? a : ADJ[G.cur].filter((n) => n !== 0 && N[n].x > N[G.cur].x);
}
function walkTo(n) {
	if (MV) return;
	MV = { a: G.cur, b: n, t0: t, d: 0.55 };
	TIPN = null;
	sfx("step");
}
function flowTick() {
	if (MV && Machine.is("map") && t - MV.t0 >= MV.d) {
		const b = MV.b;
		MV = null;
		go(b);
	}
}

// ---------- новая игра ----------
function freshG() {
	return { coin: 20, meat: 8, slots: Array(8).fill(null), cur: 0, vis: new Set([0]), depth: 0, bf: { atk: 0, hp: 0, arm: 0, as: 0, spd: 0 }, shop: false, rm: false, sk: false, sm: "", w: 0, rel: [], stock: null, pend: null, st: { kills: 0, dmg: 0, fights: 0, crits: 0 }, wave: 0, arena: false };
}
function newGame() {
	snap = null;
	G = freshG();
	F = null;
	EV = null;
	MV = null;
	pop = null;
	sel = -1;
	paused = false;
	Seq.clear();
	Parts.clear();
	genMap();
	bakeMap(1 + ((Rand.next() * 2147483000) | 0));
}
function recruit(h, r) {
	const u = mkHero(h, r);
	applyPerks(u);
	return u;
}
function arenaStart() {
	newGame();
	G.arena = true;
	HEROES.slice()
		.sort(() => Rand.next() - 0.5)
		.slice(0, 3)
		.forEach((h, i) => (G.slots[i] = recruit(h, 0)));
	arenaNext();
}
function arenaNext() {
	G.wave++;
	G.shop = false;
	G.stock = null;
	G.w = (Rand.next() * worldCount()) | 0;
	G.depth = 3 + G.wave;
	fight(G.wave % 5 === 0 ? "boss" : ["norm", "arena", "swamp", "norm"][G.wave % 4]);
}
function toMenu() {
	paused = false;
	pop = null;
	F = null;
	EV = null;
	MV = null;
	Seq.clear();
	Machine.go("menu");
}

// ---------- события ----------
function ev(o) {
	EV = Object.assign({ t0: t, cards: [], sel: -1, open: o.chest === undefined ? 1 : 0, rv: [] }, o);
	Machine.go("msg");
	pop = null;
	TIPN = null;
}
function msg(s) {
	const l = s.split("\n");
	ev({ title: l[0], sub: l.slice(1).join(" ") });
}
function rollRelic(lk, min = 0) {
	return { id: pick(RELIC_IDS), r: rollRar(lk, min) };
}
// три разные реликвии для витрины: в одной лавке не бывает двух одинаковых
function rollRelics(n, lk, min = 0) {
	const ids = RELIC_IDS.slice(),
		out = [];
	while (out.length < n && ids.length) out.push({ id: ids.splice((Rand.next() * ids.length) | 0, 1)[0], r: rollRar(lk, min), sold: 0 });
	return out;
}
function grantRelic(q) {
	G.rel.push({ id: q.id, r: q.r });
	const d = RELIC[q.id];
	if (d.st) G.slots.forEach((u) => u && d.st(u, RAR[q.r].m));
}
function evClose() {
	const e = EV;
	if (!e) return;
	if (e.pick && e.sel >= 0) {
		const c = e.cards[e.sel];
		if (c.t === "relic") grantRelic(c);
	}
	// значки наград летят к счётчикам
	e.cards.forEach((c, i) => {
		if (c.t === "res" && (c.ic === "coin" || c.ic === "meat")) for (let k = 0; k < Math.min(6, c.n); k++) Fly.add(c.ic + "_s", c.x || 609, c.y || 270, c.ic === "coin" ? 29 : 139, 25, k * 0.05);
	});
	EV = null;
	if (e.next) e.next();
	else {
		Machine.go("map");
		autosave();
	}
}
function evTribe() {
	const f = G.slots.indexOf(null),
		h = rnd(HEROES),
		r = rollRar(luck() * 0.85);
	if (f >= 0) {
		const u = recruit(h, r);
		G.slots[f] = u;
		ev({ title: "Племя", sub: "К отряду присоединился новый боец", cards: [{ t: "hero", u, r }] });
	} else {
		const c = Math.round((6 + 4 * r) * cmul());
		G.coin += c;
		ev({ title: "Племя", sub: "Отряд полон — племя откупилось золотом", cards: [{ t: "res", ic: "coin", n: c }] });
	}
}
function evChest(min = 0, title = "Сундук", sub = "Внутри — реликвия для всего отряда") {
	const q = rollRelic(luck() + (min ? 0.6 : 0), min);
	grantRelic(q);
	ev({ title, sub, chest: q.r >= 4 ? 2 : q.r >= 2 ? 1 : 0, cards: [{ t: "relic", id: q.id, r: q.r }] });
}
function evSecret() {
	const r = Rand.next();
	if (r < 0.45) evChest(2, "Тайник", "Древний клад с редкой реликвией");
	else if (r < 0.75 && G.slots.indexOf(null) >= 0) {
		const u = recruit(rnd(HEROES), rollRar(luck() + 0.6, 2));
		G.slots[G.slots.indexOf(null)] = u;
		ev({ title: "Тайник", sub: "В заброшенном лагере ждал опытный боец", cards: [{ t: "hero", u, r: u.r }] });
	} else {
		const c = Math.round(12 * cmul()),
			m = 3 + (G.w || 0);
		G.coin += c;
		G.meat += m;
		ev({
			title: "Тайник",
			sub: "Чей-то забытый схрон",
			chest: 0,
			cards: [
				{ t: "res", ic: "coin", n: c },
				{ t: "res", ic: "meat", n: m },
			],
		});
	}
}
function go(n) {
	G.shop = false;
	G.stock = null;
	const fresh = !G.vis.has(n);
	G.cur = n;
	G.vis.add(n);
	if (!fresh) {
		autosave();
		return;
	}
	G.depth++;
	const k = N[n].k || "rand";
	if (k === "tribe") evTribe();
	else if (k === "mine") {
		const c = Math.round(5 * cmul());
		G.coin += c;
		ev({ title: "Шахта", sub: "Гоблины-рудокопы делятся добычей", cards: [{ t: "res", ic: "coin", n: c }] });
	} else if (k === "barr") {
		G.slots.forEach((u) => {
			if (u) {
				u.max = Math.round(u.max * 1.1);
				u.hp = u.max;
			}
		});
		ev({ title: "Казармы", sub: "Отдых и тренировка", cards: [{ t: "txt", ic: "hp", s: "Здоровье отряда +10%", s2: "Все бойцы вылечены" }] });
	} else if (k === "chest") evChest();
	else if (k === "secret") evSecret();
	else if (k === "rand") {
		const r = Rand.next();
		if (r < 0.6) enter("norm");
		else if (r < 0.8) {
			const m = 2 + (G.w || 0);
			G.meat += m;
			ev({ title: "Находка", sub: "На привале нашлась еда", cards: [{ t: "res", ic: "meat", n: m }] });
		} else {
			const c = Math.round(3 * cmul());
			G.coin += c;
			ev({ title: "Находка", sub: "Кошель у дороги", cards: [{ t: "res", ic: "coin", n: c }] });
		}
	} else enter(k);
}
// вход в бой: сохранение запоминает незавершённый бой — выйти и «переиграть» узел нельзя
function enter(kind) {
	G.pend = kind;
	fight(kind);
	snap = ser();
	autosave();
}
// ---------- победа: общая часть, затем ветка арены / босса / обычного боя ----------
function win() {
	const kind = F.kind,
		rb = relBonus(),
		st = F.st;
	G.pend = null;
	G.st.fights++;
	G.st.kills += st.kills;
	G.st.dmg += st.dmg;
	G.st.crits += st.crits;
	G.slots.forEach((u) => {
		if (u) {
			u.placed = false;
			u.hp = Math.min(u.max, Math.max(u.hp, Math.ceil(u.max * BAL.win.healFloor)) + Math.round(u.max * BAL.win.healBonus));
			resetU(u);
		}
	});
	const stats = ["Урон: " + fmt(st.dmg), "Критов: " + st.crits, "Время: " + Math.round(F.time) + " с"];
	BGA = F.A;
	F = null;
	pop = null;
	Events.emit("fight:won", kind, st);
	if (G.arena) winArena(kind, rb, stats);
	else if (kind === "boss") winBoss(rb, stats);
	else winFight(kind, rb, stats);
}
// арена: монеты и мясо за волну, каждую вторую волну — трофей или новобранец, затем лавка
function winArena(kind, rb, stats) {
	const c = BAL.win.arenaCoin + BAL.win.arenaCoinWave * G.wave + rb.coin,
		m = 1 + (G.wave % 3 === 0 ? 1 : 0),
		cards = [
			{ t: "res", ic: "coin", n: c },
			{ t: "res", ic: "meat", n: m },
		];
	G.coin += c;
	G.meat += m;
	if (G.wave > (CFG.arenaBest || 0)) {
		CFG.arenaBest = G.wave;
		saveCfg();
	}
	const after = () => {
		G.shop = true;
		G.stock = null;
		Machine.go("shop");
		SS.sel = -1;
	};
	ev({
		bg: 1,
		title: "Волна " + G.wave + " пройдена",
		sub: kind === "boss" ? "Босс повержен!" : "Арена ликует",
		stats,
		cards,
		next:
			G.wave % 2 === 0
				? () => {
						const f = G.slots.indexOf(null);
						if (G.wave % 4 === 0 && f >= 0) {
							const u = recruit(rnd(HEROES), rollRar(G.wave * 0.25));
							G.slots[f] = u;
							ev({ title: "Новобранец", sub: "Толпа выдвинула своего бойца", cards: [{ t: "hero", u, r: u.r }], next: after });
						} else ev({ title: "Трофей арены", sub: "Выбери одну реликвию", pick: 1, chest: 1, cards: [0, 1, 2].map(() => ({ t: "relic", ...rollRelic(G.wave * 0.3) })), next: after });
					}
				: after,
	});
}
// босс: трофеи, полное лечение, сокровищница, затем следующий мир или финал
function winBoss(rb, stats) {
	const c = Math.round(BAL.win.bossCoin * cmul()) + rb.coin,
		m = BAL.win.bossMeat + (G.w || 0);
	G.coin += c;
	G.meat += m;
	G.slots.forEach((u) => u && (u.hp = u.max));
	if ((G.w || 0) + 1 > (CFG.best || 0)) {
		CFG.best = (G.w || 0) + 1;
		saveCfg();
	}
	ev({
		bg: 1,
		title: WORLDS[G.w].boss.n + " повержен!",
		sub: "Трофеи босса",
		stats,
		cards: [
			{ t: "res", ic: "coin", n: c },
			{ t: "res", ic: "meat", n: m },
		],
		next: () =>
			ev({
				title: "Сокровищница босса",
				sub: "Выбери одну реликвию",
				pick: 1,
				chest: 2,
				cards: [0, 1, 2].map(() => ({ t: "relic", ...rollRelic(luck() + 1, 2) })),
				next: () => {
					if (G.w + 1 >= worldCount()) {
						delSave();
						Machine.go("win");
						sfx("fanfare");
					} else {
						Machine.go("world");
						WT0 = t;
						autosave();
					}
				},
			}),
	});
}
// обычный бой / узел арены / логово: награда, шанс реликвии, открывается лавка
function winFight(kind, rb, stats) {
	const c = Math.round((kind === "arena" ? BAL.win.arenaNodeCoin : BAL.win.fightCoin + G.depth) * cmul()) + rb.coin,
		m = (kind === "arena" ? 2 : 1) + ((G.w || 0) >> 1),
		cards = [
			{ t: "res", ic: "coin", n: c },
			{ t: "res", ic: "meat", n: m },
		];
	G.coin += c;
	G.meat += m;
	if (kind === "arena" || Rand.next() < (kind === "swamp" ? BAL.win.swampRelicChance : BAL.win.relicChance)) {
		const q = rollRelic(luck() + (kind === "arena" ? 0.8 : 0), kind === "arena" ? 1 : 0);
		grantRelic(q);
		cards.push({ t: "relic", id: q.id, r: q.r });
	}
	G.shop = true;
	G.stock = null;
	ev({ bg: 1, title: "Победа!", sub: "Открыта лавка — тележка в правом верхнем углу", stats, cards });
}
let WT0 = 0;
function nextWorld() {
	G.w++;
	G.depth = 0;
	G.cur = 0;
	G.vis = new Set([0]);
	G.shop = true;
	G.stock = null;
	G.slots.forEach((u) => u && (u.hp = u.max));
	genMap();
	bakeMap(1 + ((Rand.next() * 2147483000) | 0));
	Machine.go("map");
	Parts.clear();
	autosave();
}
function lose() {
	if (G.arena && G.wave - 1 > (CFG.arenaBest || 0)) {
		CFG.arenaBest = G.wave - 1;
		saveCfg();
	}
	if (!G.arena) delSave();
	if (F) BGA = F.A;
	Machine.go("lose");
	pop = null;
	sfx("lose");
}

// ---------- магазин ----------
function shopStock() {
	if (!G.stock) G.stock = { rel: rollRelics(BAL.shop.stock, luck() + (G.arena ? G.wave * 0.2 : 0)), rr: 0 };
	return G.stock;
}
function openShop() {
	if (!G.shop) {
		toast("Лавка открывается после победы в бою", "ic_cart");
		sfx("err");
		return;
	}
	shopStock();
	SS.sel = -1;
	G.sm = "";
	G.rm = G.sk = false;
	pop = null;
	Machine.go("shop");
	sfx("chest");
}
const rrPrice = () => BAL.shop.rrBase + BAL.shop.rrStep * G.stock.rr;
function buyRelic(i) {
	const q = G.stock.rel[i],
		p = relPrice(q.r, G.w);
	if (q.sold) return false;
	if (G.coin < p) {
		G.sm = "Не хватает монет";
		sfx("err");
		return false;
	}
	G.coin -= p;
	q.sold = 1;
	grantRelic(q);
	G.sm = "Куплено: " + RELIC[q.id].n;
	sfx("rev" + q.r);
	return true;
}
function reroll() {
	const p = rrPrice();
	if (G.coin < p) {
		G.sm = "Не хватает монет";
		sfx("err");
		return;
	}
	G.coin -= p;
	G.stock.rr++;
	const keep = G.stock.rel.filter((q) => q.sold),
		fresh = rollRelics(BAL.shop.stock - keep.length, luck() + (G.arena ? G.wave * 0.2 : 0));
	fresh.forEach((q) => (q.nw = t));
	G.stock.rel = [...keep, ...fresh];
	G.sm = "Товар обновлён";
	sfx("coin");
}

// ---------- сохранения ----------
function ser() {
	return JSON.stringify({
		v: 2,
		N,
		E,
		sd: SD,
		bi: 0,
		g: {
			coin: G.coin,
			meat: G.meat,
			cur: G.cur,
			vis: [...G.vis],
			depth: G.depth,
			bf: G.bf,
			shop: G.shop,
			w: G.w || 0,
			rel: G.rel,
			stock: G.stock,
			pend: G.pend || null,
			st: G.st,
			slots: G.slots.map((u) => (u ? { n: u.n, hp: Math.max(0, Math.round(u.hp)), max: u.max, atk: u.atk, arm: u.arm, aspd: u.aspd, spd: u.spd, skull: u.skull ? 1 : 0, r: u.r || 0, lv: u.lv || 1 } : null)),
		},
	});
}
// saveGame / loadGame / autosave переехали в 62_save.js (формат v3, резерв, миграции)
function saveCfg() {
	CFG.music = Music.on;
	CFG.vol = Music.vol;
	try {
		window.__mxStorage.setItem(CFGK, JSON.stringify(CFG));
	} catch (e) {}
}

