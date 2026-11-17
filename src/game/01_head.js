try {
	if (!window.__mxStorage) {
		const _mxm = new Map();
		window.__mxStorage = {
			getItem: (k) => (_mxm.has(String(k)) ? _mxm.get(String(k)) : null),
			setItem: (k, v) => _mxm.set(String(k), String(v)),
			removeItem: (k) => _mxm.delete(String(k)),
		};
	}
} catch (e) {}
const cv = document.getElementById("c"),
	W = 1218,
	H = 540;
let ctx = cv.getContext("2d");
cv.width = W;
cv.height = H;
ctx.imageSmoothingEnabled = false;
let R = 1,
	lastS = "",
	FADE = 0,
	MT = 0;
const PAL = {
	b: "#3b8fd0",
	h: "#b5651d",
	d: "#5a2d0c",
	r: "#e53935",
	w: "#fff",
	g: "#2e7d32",
	l: "#9ccc65",
	s: "#b0b7c0",
	S: "#5c6470",
	R: "#c62828",
	y: "#ffc107",
	p: "#7b1fa2",
	P: "#ce93d8",
	t: "#d7a86e",
	k: "#111",
	n: "#8d6e63",
	e: "#4caf50",
	E: "#2e7d32",
	m: "#e53935",
	Y: "#fdd835",
};
function spr(rows, pal) {
	const c = document.createElement("canvas");
	c.width = c.height = 16;
	const x = c.getContext("2d");
	rows.forEach((r, j) =>
		[...r].forEach((ch, i) => {
			if (ch != ".") {
				x.fillStyle = (pal && pal[ch]) || PAL[ch];
				x.fillRect(i + 2, j + 2, 1, 1);
			}
		}),
	);
	const d = x.getImageData(0, 0, 16, 16).data,
		o = x.createImageData(16, 16),
		q = o.data,
		A = (i, j) => (i < 0 || j < 0 || i > 15 || j > 15 ? 0 : d[(j * 16 + i) * 4 + 3]);
	for (let j = 0; j < 16; j++)
		for (let i = 0; i < 16; i++) {
			const k = (j * 16 + i) * 4;
			if (d[k + 3]) {
				let m = 1,
					a = 0;
				if (!A(i, j - 1) || !A(i - 1, j)) a = 45;
				else if (!A(i, j + 1) || !A(i + 1, j)) m = 0.68;
				else if (j > 9) m = 0.88;
				q[k] = Math.min(255, d[k] * m + a);
				q[k + 1] = Math.min(255, d[k + 1] * m + a);
				q[k + 2] = Math.min(255, d[k + 2] * m + a);
				q[k + 3] = 255;
			} else if (A(i - 1, j) || A(i + 1, j) || A(i, j - 1) || A(i, j + 1)) {
				q[k] = 10;
				q[k + 1] = 8;
				q[k + 2] = 18;
				q[k + 3] = 255;
			}
		}
	x.putImageData(o, 0, 0);
	return c;
}
const SH = spr([
	"l.bb.bb.b...",
	"g.bbbbbbbb..",
	"g.bhhhhhhb..",
	"g.hhrhhrhh..",
	"g.hhhhhhhh..",
	"g.hhkwkwhh..",
	"g..hwwwwh...",
	"g..hdddddh..",
	"g..dddddd...",
	"g...d..d....",
	"............",
	"............",
]);
const KN = spr([
	"....RR......",
	"...RRRs.s...",
	"..sssssSs...",
	"..sSkkkSs...",
	"..sSSSSSs..s",
	"..ssssssss.s",
	"R.sssssss.ss",
	"R..ssssss.s.",
	"...SSSSS..s.",
	"....S..S....",
	"............",
	"............",
]);
const PA = spr([
	".....g.g....",
	"....gggg....",
	"..SSSSSSS...",
	".SsssysssS..",
	".SsyyyyysS..",
	".SsssysssS..",
	".SsssysssS..",
	"..SSSSSSS.nn",
	"..sSSSSSs.n.",
	"...SS.SS..n.",
	"............",
	"............",
]);
const BA = spr([
	"...pppppp...",
	"..ppPPPPpp..",
	".pPPPPPPPPp.",
	".pttttttttp.",
	"..tkttttkt.n",
	"..tttttttt.n",
	"...tttttt.n.",
	"...hhhhhh.n.",
	"..hhhhhhh.n.",
	"...h....h...",
	"............",
	"............",
]);
const CAT = spr(
	[
		"......q...q.",
		"......qqqqq.",
		"......ququq.",
		"......cqqqc.",
		"q....cccccc.",
		"qqcccccccccc",
		".ccccccccccc",
		".ccccccccccc",
		"..cc....cc..",
		"..qq....qq..",
		"............",
		"............",
	],
	{ c: "#f3e3c3", q: "#4a2f22", u: "#4fc3f7" },
);
const slimeRows = [
	"......mm....",
	".....mmmm...",
	"......EE....",
	"...eeeeeee..",
	"..eeeeeeeee.",
	".eeYeeeeYeee",
	".eeeeeeeeeee",
	"eeeeeeeeeeee",
	"............",
	"............",
	"............",
	"............",
];
const SL = spr(slimeRows),
	SW = spr(slimeRows, { e: "#7e6fe0", E: "#483d8b" }),
	SR = spr(slimeRows, { e: "#e57373", E: "#b71c1c", m: "#fdd835" });
const HEROES = [
	{ n: "Гоб-богомолец", spr: SH, hp: 2000, atk: 50, aspd: 1, arm: 10, rng: 150, spd: 5, heal: 30, sc: 0.6 },
	{ n: "Рыцарь", spr: KN, hp: 3000, atk: 80, aspd: 0.8, arm: 30, rng: 50, spd: 6, sc: 0.6 },
	{ n: "Паладин", spr: PA, hp: 3500, atk: 60, aspd: 0.7, arm: 40, rng: 50, spd: 5, sc: 0.6 },
	{ n: "Боец", spr: BA, hp: 2400, atk: 90, aspd: 0.9, arm: 15, rng: 50, spd: 7, sc: 0.6 },
	{ n: "Морозный страж", spr: KN, k: "frost", hp: 3400, atk: 65, aspd: 0.75, arm: 35, rng: 50, spd: 5, sc: 0.6, rar: 2, desc: "Страж вечной мерзлоты. Его клинок выкован из льда, а сердце не знает тепла." },
	{ n: "Пепельный берсерк", spr: KN, k: "pyro", hp: 3100, atk: 85, aspd: 0.85, arm: 20, rng: 50, spd: 6, sc: 0.6, rar: 2, desc: "Воин, чья ярость — лава. Он не чувствует боли, только жар битвы." },
	{ n: "Тёмный некромант", spr: KN, k: "necro", hp: 2200, atk: 70, aspd: 0.9, arm: 10, rng: 150, spd: 5, sc: 0.6, rar: 3, desc: "Повелитель теней. Его посох шепчет голосами тех, кто уже не вернётся." },
	{ n: "Грозовой маг", spr: KN, k: "volt", hp: 2400, atk: 75, aspd: 1, arm: 15, rng: 150, spd: 6, sc: 0.6, rar: 3, desc: "Маг, повелевающий грозой. Его посох зовёт молнии с неба." },
	{ n: "Страж Древнего леса", spr: KN, k: "druid", hp: 3200, atk: 55, aspd: 0.8, arm: 25, rng: 50, spd: 5, heal: 35, sc: 0.6, rar: 2, desc: "Древень, помнящий первый рассвет. Его корни держат мир от падения." },
	{ n: "Призрачный убийца", spr: KN, k: "shade", hp: 2100, atk: 95, aspd: 1.1, arm: 8, rng: 50, spd: 8, sc: 0.62, rar: 4, desc: "Тень без тела. Он появляется за спиной — и это уже поздно." },
	{ n: "Каменный голем", spr: KN, k: "golem", hp: 4200, atk: 60, aspd: 0.6, arm: 50, rng: 50, spd: 4, sc: 0.68, rar: 3, desc: "Живая гора. Его шаги сотрясают землю, а кулаки — скалы." },
	{ n: "Эльфийский следопыт", spr: KN, k: "archer", hp: 2300, atk: 80, aspd: 0.95, arm: 12, rng: 170, spd: 7, sc: 0.6, rar: 2, desc: "Стрелок, слышащий лес. Его стрелы не промахиваются." },
	{ n: "Кристальный провидец", spr: KN, k: "prism", hp: 2100, atk: 85, aspd: 0.85, arm: 10, rng: 150, spd: 5, sc: 0.6, rar: 4, desc: "Видит нити судьбы в свете кристаллов. Его луч режет реальность." },
	{ n: "Кровавый рыцарь", spr: KN, k: "vamp", hp: 2800, atk: 88, aspd: 0.9, arm: 18, rng: 50, spd: 6, sc: 0.72, rar: 4, desc: "Рыцарь, продавший кровь за силу. Каждый удар делает его сильнее." },
];
const ENEM = {
	slime: { n: "Зеленый слизень", spr: SL, hp: 1500, atk: 55, aspd: 0.8, arm: 5, rng: 100, spd: 6 },
	swamp: { n: "Болотный слизень", spr: SW, hp: 2200, atk: 75, aspd: 0.8, arm: 15, rng: 100, spd: 6 },
	red: { n: "Красный слизень", spr: SR, hp: 3000, atk: 100, aspd: 0.85, arm: 25, rng: 90, spd: 7 },
	boss: { n: "Король слизней", spr: SR, hp: 14000, atk: 190, aspd: 0.75, arm: 50, rng: 110, spd: 4, big: 1 },
};
let N = [],
	E = [],
	ADJ = [];
let seed = 7;
const rn = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const BIOMES = [
	{
		n: "Тёмный лес",
		bg: "#020d0a",
		P: ["#031009", "#05221a", "#0a3328", "#12503f"],
		lake: "#0b3b52",
		rim: "#2b7a8c",
		hi: "#6fd3e8",
		ff: "255,240,120",
		mist: "120,220,190",
		fall: null,
	},
	{
		n: "Осенняя чаща",
		bg: "#140803",
		P: ["#1d0b05", "#3d160a", "#7a3412", "#c26a22"],
		lake: "#2b3552",
		rim: "#8a5a2b",
		hi: "#b9c7ff",
		ff: "255,190,90",
		mist: "255,170,90",
		fall: "#e8812e",
	},
	{
		n: "Мёртвое болото",
		bg: "#080f08",
		P: ["#0a140a", "#18271a", "#2a3f26", "#4d6b34"],
		lake: "#2a4a2a",
		rim: "#6d8a3a",
		hi: "#b6e06a",
		ff: "170,255,120",
		mist: "150,200,110",
		fall: null,
	},
	{
		n: "Ледяной бор",
		bg: "#050a14",
		P: ["#08111d", "#0f2a42", "#1b4a70", "#8cc0e4"],
		lake: "#123a60",
		rim: "#bfe4ff",
		hi: "#ffffff",
		ff: "190,230,255",
		mist: "170,210,255",
		fall: "#eaf6ff",
	},
	{
		n: "Багровая роща",
		bg: "#12040d",
		P: ["#1a0614", "#3b0c2b", "#68144a", "#b0307a"],
		lake: "#2a0a4a",
		rim: "#a64cd6",
		hi: "#ff9be6",
		ff: "255,120,200",
		mist: "230,120,210",
		fall: "#ff8ec7",
	},
];
let mapBG = document.createElement("canvas"),
	BIOME = BIOMES[0],
	GL = [],
	SD = 7,
	BI = 0;
const AT = new Image();
let AR = 0,
	RPT = [];
const ART = {
	TL: [0, 0, 256, 256],
	T1: [
		[287, 670, 66, 79],
		[776, 559, 74, 85],
		[355, 670, 66, 79],
		[854, 670, 68, 71],
		[924, 670, 60, 70],
		[502, 755, 54, 68],
	],
	T2: [
		[312, 434, 94, 116],
		[408, 434, 92, 114],
		[104, 434, 99, 120],
		[205, 434, 105, 118],
		[0, 434, 102, 123],
		[612, 434, 93, 111],
	],
	T3: [
		[0, 258, 129, 174],
		[131, 258, 134, 172],
		[267, 258, 130, 170],
		[399, 258, 124, 168],
		[525, 258, 122, 153],
		[649, 258, 108, 141],
	],
	DC: [
		[104, 670, 90, 81],
		[196, 670, 89, 80],
		[261, 755, 77, 69],
		[690, 755, 75, 65],
		[558, 755, 73, 67],
		[767, 755, 106, 64],
		[691, 559, 83, 86],
		[593, 559, 96, 89],
		[500, 559, 91, 90],
		[706, 670, 91, 76],
		[340, 755, 79, 69],
		[260, 827, 65, 53],
		[0, 670, 102, 83],
		[423, 670, 92, 79],
		[517, 670, 86, 77],
		[421, 755, 79, 69],
		[440, 827, 59, 49],
		[163, 827, 95, 55],
		[852, 559, 103, 84],
		[605, 670, 99, 77],
		[0, 755, 88, 70],
		[74, 827, 87, 58],
		[0, 827, 72, 60],
		[501, 827, 54, 39],
		[327, 827, 60, 52],
		[90, 755, 86, 70],
		[178, 755, 81, 70],
	],
	LK: [
		[643, 0, 304, 187],
		[258, 0, 383, 205],
		[759, 258, 178, 137],
	],
	RD: [
		[333, 559, 95, 103],
		[430, 559, 68, 94],
		[799, 670, 53, 76],
		[633, 755, 55, 67],
		[875, 755, 61, 63],
		[389, 827, 49, 50],
	],
	ICN: {
		tribe: [818, 434, 109, 109],
		swamp: [0, 559, 106, 109],
		arena: [222, 559, 109, 107],
		barr: [502, 434, 108, 112],
		mine: [707, 434, 109, 111],
		boss: [108, 559, 112, 109],
	},
};
AT.onload = () => {
	AR = 1;
	if (N.length) mkBG(SD, BI);
};
function mkBG(s, b) {
	BI = b;
	BIOME = BIOMES[0];
	SD = s;
	seed = s;
	GL = [];
	const Q = 2,
		c = document.createElement("canvas");
	c.width = W * Q;
	c.height = H * Q;
	const x = c.getContext("2d");
	x.scale(Q, Q);
	x.imageSmoothingQuality = "high";
	RPT = roadPts();
	mkField(x);
	let LA = [];
	if (AR) LA = bakeLakes(x);
	bakeRoads(x);
	if (AR) bakeTrees(x, LA);
	const v = x.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.65);
	v.addColorStop(0, "rgba(0,0,0,0)");
	v.addColorStop(1, "rgba(0,0,0,.4)");
	x.fillStyle = v;
	x.fillRect(0, 0, W, H);
	mapBG = c;
}
function roadPts() {
	const p = [];
	E.forEach((e) => {
		const a = N[e[0]],
			b = N[e[1]],
			n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 10);
		for (let i = 0; i <= n; i++) p.push([a.x + ((b.x - a.x) * i) / n, a.y + ((b.y - a.y) * i) / n]);
	});
	return p;
}
function blk(x, y, w, h) {
	for (const n of N) if (x + w / 2 > n.x - 40 && x - w / 2 < n.x + 40 && y > n.y - 72 && y - h < n.y + 30) return 1;
	for (const p of RPT) if (p[0] > x - w * 0.45 && p[0] < x + w * 0.45 && p[1] > y - h * 0.4 - 4 && p[1] < y + 6) return 1;
	return 0;
}
function put(x, r, cx, cy, f, fl) {
	const w = r[2] * f,
		h = r[3] * f;
	x.save();
	x.translate(cx, cy);
	if (fl) x.scale(-1, 1);
	x.drawImage(AT, r[0], r[1], r[2], r[3], -w / 2, -h, w, h);
	x.restore();
}
function mkField(x) {
	const g = x.createLinearGradient(0, 0, 0, H);
	g.addColorStop(0, "#2d6a34");
	g.addColorStop(1, "#1f4f28");
	x.fillStyle = g;
	x.fillRect(0, 0, W, H);
	if (AR) {
		const t = ART.TL,
			s = 128;
		for (let j = 0; j * s < H; j++)
			for (let i = 0; i * s < W; i++) {
				x.save();
				x.translate(i * s + (i % 2 ? s : 0), j * s + (j % 2 ? s : 0));
				x.scale(i % 2 ? -1 : 1, j % 2 ? -1 : 1);
				x.drawImage(AT, t[0], t[1], t[2], t[3], 0, 0, s, s);
				x.restore();
			}
	}
}
function bakeLakes(x) {
	const LA = [];
	for (let i = 0; i < 150 && LA.length < 3; i++) {
		const r = ART.LK[(rn() * ART.LK.length) | 0],
			f = 0.55 + rn() * 0.35,
			w = r[2] * f,
			h = r[3] * f,
			mx = w / 2 + 20 + rn() * (W - w - 40),
			my = h / 2 + 20 + rn() * (H - h - 130);
		if (LA.some((l) => Math.abs(l.x - mx) < (l.w + w) / 2 + 16 && Math.abs(l.y - my) < (l.h + h) / 2 + 16)) continue;
		const ell = (px, py, m) => ((px - mx) / (w / 2 + m)) ** 2 + ((py - my) / (h / 2 + m)) ** 2 < 1;
		if (N.some((n) => ell(n.x, n.y, 34)) || RPT.some((p) => ell(p[0], p[1], 6))) continue;
		put(x, r, mx, my + h / 2, f, rn() < 0.5);
		LA.push({ x: mx, y: my, w, h });
	}
	return LA;
}
function bakeRoads(x) {
	x.lineCap = "round";
	[
		[7, "rgba(0,0,0,.35)"],
		[3, "#c4cac3"],
	].forEach(([w, c]) => {
		x.strokeStyle = c;
		x.lineWidth = w;
		x.beginPath();
		E.forEach((e) => {
			x.moveTo(N[e[0]].x, N[e[0]].y);
			x.lineTo(N[e[1]].x, N[e[1]].y);
		});
		x.stroke();
	});
}
function bakeTrees(x, LA) {
	const inL = (cx, cy, m) => LA.some((l) => ((cx - l.x) / (l.w / 2 + m)) ** 2 + ((cy - l.y) / (l.h / 2 + m)) ** 2 < 1);
	const D = [];
	for (let i = 0; i < 100; i++) {
		const r = ART.DC[(rn() * ART.DC.length) | 0],
			f = 0.38 + rn() * 0.14,
			w = r[2] * f,
			h = r[3] * f,
			cx = 10 + rn() * (W - 20),
			cy = h + 10 + rn() * (H - h - 20);
		if (blk(cx, cy, w, h) || inL(cx, cy - h / 2, 8)) continue;
		D.push([r, f, cx, cy, rn() < 0.5]);
	}
	D.sort((a, b) => a[3] - b[3]).forEach((d) => put(x, d[0], d[2], d[3], d[1], d[4]));
	LA.forEach((l) => {
		for (let i = 0; i < 7; i++) {
			const r = ART.RD[(rn() * ART.RD.length) | 0],
				a = rn() * 6.28;
			put(x, r, l.x + Math.cos(a) * l.w * 0.44, l.y + Math.sin(a) * l.h * 0.42 + 6, 0.5, rn() < 0.5);
		}
	});
	[
		[ART.T1, 0.42, 300],
		[ART.T2, 0.45, 200],
		[ART.T3, 0.48, 110],
	].forEach(([T, f, n]) => {
		const P = [];
		for (let i = 0; i < n; i++) {
			const r = T[(rn() * T.length) | 0],
				w = r[2] * f,
				h = r[3] * f,
				cx = rn() * W,
				cy = h * 0.5 + rn() * (H + 10);
			if (blk(cx, cy, w, h) || inL(cx, cy - h * 0.15, 6) || P.some((p) => Math.abs(p[2] - cx) < w * 0.35 && Math.abs(p[3] - cy) < h * 0.22)) continue;
			P.push([r, f, cx, cy, rn() < 0.5]);
		}
		P.sort((a, b) => a[3] - b[3]).forEach((d) => put(x, d[0], d[2], d[3], d[1], d[4]));
	});
}
let SK = 0,
	SPDX = 2,
	S = "menu",
	hits = [],
	paused = false,
	t = 0,
	sel = -1,
	pop = null,
	M = "",
	F = null,
	G = null;
const rnd = (a) => a[Math.floor(Rand.next() * a.length)];
function area(x, y, w, h, f) {
	hits.push({ x, y, w, h, f });
}
function sp(c, x, y, s) {
	ctx.drawImage(c, x - 8 * s, y - 14 * s, 16 * s, 16 * s);
}
const SAVEK = "monsterAwakeningSave",
	SAVEK_B = "monsterAwakeningSave.bak",
	CFGK = "monsterAwakeningCfg";
let CFG = { music: true, vol: 1, fps: false },
	SAVED = false,
	snap = null,
	delAsk = false,
	TOAST = { s: "", u: 0 };
try {
	Object.assign(CFG, JSON.parse(window.__mxStorage.getItem(CFGK) || "{}"));
} catch (e) {}
try {
	SAVED = !!window.__mxStorage.getItem(SAVEK);
} catch (e) {}
function delSave() {
	try {
		window.__mxStorage.removeItem(SAVEK);
		window.__mxStorage.removeItem(SAVEK_B);
	} catch (e) {}
	SAVED = false;
}
function doExit() {
	try {
		if (navigator.app && navigator.app.exitApp) navigator.app.exitApp();
	} catch (e) {}
	try {
		window.close();
	} catch (e) {}
	Timers.after(250, () => {
		location.replace("about:blank");
	}, "boot");
}
function mist() {
	for (let i = 0; i < 3; i++) {
		const x = ((t * (9 + i * 5) + i * 480) % (W + 520)) - 260,
			y = 130 + i * 105 + Math.sin(t * 0.3 + i) * 20,
			g = ctx.createRadialGradient(x, y, 10, x, y, 240);
		g.addColorStop(0, "rgba(" + BIOME.mist + ",.12)");
		g.addColorStop(1, "rgba(" + BIOME.mist + ",0)");
		ctx.fillStyle = g;
		ctx.fillRect(x - 250, y - 130, 500, 260);
	}
}
function fall() {
	if (!BIOME.fall) return;
	ctx.fillStyle = BIOME.fall;
	for (let i = 0; i < 26; i++) {
		const x = (i * 83 + t * (14 + (i % 5) * 6) + Math.sin(t + i) * 20) % W,
			y = (t * (30 + (i % 4) * 14) + i * 37) % H;
		ctx.fillRect(x | 0, y | 0, i % 3 ? 3 : 4, i % 3 ? 3 : 2);
	}
}
HEROES[0].k = "mage";
HEROES[1].k = "knight";
HEROES[3].k = "bandit";
const SHOP = [
	{ k: "heal", v: "p", t: "Лечение", dd: "Восстанавливает всё здоровье всем монстрам.", p: () => 4 },
	{
		k: "rm",
		v: "s",
		t: "Убрать монстра",
		dd: "Убрать монстра. Освобождает слот и возвращает 2 монеты. Нажми «Выбрать», потом на монстра внизу.",
		p: () => 0,
	},
	{
		k: "sk",
		v: "k",
		t: "Монета-череп",
		dd: "Надень на монстра. Если он погибнет в бою, ты получишь 8 монет в качестве компенсации. Если не погибнет — ничего не получишь.",
		p: () => 3,
	},
	{ k: "atk", v: "b", t: "Значок: Сила", dd: "Атака всего отряда +15%. Цена растёт с каждой покупкой.", p: () => 8 + 2 * G.bf.atk },
	{ k: "hp", v: "b", t: "Значок: Здоровье", dd: "Максимальное здоровье всего отряда +15%. Цена растёт с каждой покупкой.", p: () => 8 + 2 * G.bf.hp },
	{ k: "arm", v: "b", t: "Значок: Броня", dd: "Броня всего отряда +5. Цена растёт с каждой покупкой.", p: () => 8 + 2 * G.bf.arm },
	{ k: "as", v: "b", t: "Значок: Скорость атаки", dd: "Монстры бьют на 10% чаще. Цена растёт с каждой покупкой.", p: () => 10 + 2 * G.bf.as },
	{ k: "spd", v: "b", t: "Значок: Быстрые ноги", dd: "Монстры бегают быстрее (+1). Цена растёт с каждой покупкой.", p: () => 6 + 2 * G.bf.spd },
	{ k: "meat", v: "m", t: "Еда ×1", dd: "Еда ×1. Нужна, чтобы прокачивать монстров: +10% здоровья и +8% атаки.", p: () => 6 },
];
function bf(k, u) {
	if (k === "atk") u.atk = Math.round(u.atk * 1.15);
	else if (k === "hp") {
		const m = Math.round(u.max * 1.15);
		u.hp += m - u.max;
		u.max = m;
	} else if (k === "arm") u.arm += 5;
	else if (k === "as") u.aspd = +(u.aspd * 1.1).toFixed(2);
	else if (k === "spd") u.spd += 1;
}
function buy(it) {
	const p = it.p();
	if (it.k === "sk") {
		G.sk = !G.sk;
		G.rm = false;
		G.sm = G.sk ? "Нажми на монстра внизу, чтобы надеть монету" : "";
		return;
	}
	if (it.k === "rm") {
		G.sk = false;
		if (G.slots.filter(Boolean).length < 2) {
			G.sm = "Нельзя убрать последнего монстра";
			return;
		}
		G.rm = !G.rm;
		G.sm = G.rm ? "Нажми на монстра внизу, чтобы убрать" : "";
		return;
	}
	if (G.coin < p) {
		G.sm = "Не хватает монет";
		Music.sfx("err");
		return;
	}
	G.coin -= p;
	Music.sfx("coin");
	if (it.k === "heal")
		G.slots.forEach((u) => {
			if (u) u.hp = u.max;
		});
	else if (it.k === "meat") G.meat++;
	else {
		G.bf[it.k]++;
		G.slots.forEach((u) => u && bf(it.k, u));
	}
	G.sm = "Куплено: " + it.t;
}
const GB = {
	hp: [".xx..xx.", "xxxxxxxx", "xxxxxxxx", "xxxxxxxx", ".xxxxxx.", "..xxxx..", "...xx...", "........"],
	atk: ["......xx", ".....xxx", "....xxx.", "...xxx..", "x.xxx...", ".xxx....", "..xx....", ".x..x..."],
	arm: ["xxxxxxxx", "xxxxxxxx", "xxxxxxxx", "xxxxxxxx", ".xxxxxx.", "..xxxx..", "...xx...", "........"],
	as: ["..xxxx..", ".x....x.", "x..x...x", "x..x...x", "x..xxx.x", ".x....x.", "..xxxx..", "........"],
	rng: ["...xx...", ".xx..xx.", ".x....x.", "xx.xx.xx", "xx.xx.xx", ".x....x.", ".xx..xx.", "...xx..."],
	spd: ["..xxx...", "..xxx...", "..xxx...", "..xxx...", "..xxxxx.", ".xxxxxxx", ".xxxxxxx", "........"],
	tent: ["...xx...", "..xxxx..", "..xxxx..", ".xxxxxx.", ".xx..xx.", "xxx..xxx", "xx....xx", "xxxxxxxx"],
	frog: [".xx..xx.", "xxxxxxxx", "x.xxxx.x", "xxxxxxxx", "xxxxxxxx", ".xxxxxx.", "xx....xx", "xxx..xxx"],
	cross: ["x......x", "xx....xx", ".xx..xx.", "..xxxx..", "..xxxx..", ".xx..xx.", "xx....xx", "x......x"],
	castle: ["x.xx.xx.", "xxxxxxxx", ".xxxxxx.", ".xx..xx.", ".xxxxxx.", ".xxxxxx.", ".xx..xx.", "xxxxxxxx"],
	pick: [".xxxxx..", "x...xxx.", "....xxx.", "...xx.x.", "..xx....", ".xx.....", "xx......", "x......."],
	cart: ["x.......", "xxxxxxx.", ".xxxxxx.", ".xxxxxx.", "..xxxx..", "..x..x..", ".xx..xx.", "........"],
	skull: [".xxxxxx.", "xxxxxxxx", "xx.xx.xx", "xxxxxxxx", ".xxxxxx.", "..x.x.x.", "..xxxxx.", "........"],
};
function gly(k, cx, cy, sz, col, ol) {
	const b = GB[k];
	if (!b) return;
	const c = sz / 8,
		x0 = cx - sz / 2,
		y0 = cy - sz / 2,
		dr = (dx, dy) =>
			b.forEach((r, j) => {
				for (let i = 0; i < 8; i++) if (r[i] === "x") ctx.fillRect(x0 + i * c + dx, y0 + j * c + dy, c, c);
			});
	if (ol) {
		ctx.fillStyle = ol;
		[
			[-1, 0],
			[1, 0],
			[0, -1],
			[0, 1],
		].forEach(([dx, dy]) => dr(dx, dy));
	}
	ctx.fillStyle = col;
	dr(0, 0);
}
const SS = { sel: -1, sc: 0, max: 0, dn: null, drag: false };
GB.note = ["...xxxx.", "...xxxx.", "...x..x.", "...x..x.", "...x..x.", ".xxx.xxx", ".xxx.xxx", "........"];
const EP = [
		[36, 64],
		[1182, 64],
		[1182, 534],
		[36, 534],
	],
	MC = ["#ffd54f", "#ff5252", "#69f0ae", "#40c4ff", "#ff80ab"],
	MQ = [
		"ЕБАТЬ!!!! ЭТО ЧО !!!",
		"ЕБАТЬ СИГМААА!!!!",
		"ВОТ ЭТО ПРИЛЁТ!!!",
		"ЕБАТЬ ОН ЛЕТИТ!!!",
		"СИГМА МАФИН НА СВЯЗИ!!!",
		"ЭТО ЧТО БЫЛО ВООБЩЕ?!",
		"ЕБАТЬ ТЫ КОТЯРА!!!",
		"ВАНШОТ НА СИГМЕ!!!",
		"ЕБААААТЬ ОН ВЕЗДЕ!!!",
		"ЭТО ЧО ЗА КОТ ТАКОЙ!!!",
		"МАФИН НЕ ПРОЩАЕТ!!!",
		"ЕБАТЬ КЕКСИК ВЫШЕЛ ИЗ ЧАТА!!!",
		"ПЫЩ И ВСЁ!!!",
		"КОТ СИГМА ТАК НАДО!!!",
		"ГГ ИЗИ МАФИН!!!",
		"ЕБАТЬ ЭТО ЖЕ САМ МАФИН!!!",
	];
let EGG = { c: 0, t: 0 };
function eggTap() {
	const n = performance.now();
	EGG.c = n - EGG.t < 1500 ? EGG.c + 1 : 1;
	EGG.t = n;
	if (EGG.c >= 3 && S === "fight" && F && !F.cat) {
		EGG.c = 0;
		paused = false;
		summonCat();
	}
}
function summonCat() {
	const tg = F.en.filter((e) => e.hp > 0).sort((a, b) => a.x - b.x)[0];
	if (!tg) return;
	F.cat = { x: -60, y: tg.y, st: "run", t: 0, tg, face: 1 };
	F.fl.push({ x: 170, y: tg.y - 70, s: "Мафин!", c: "#ffd54f", t: 0.8 });
	Music.sfx("boom");
}
function drawCat() {
	const C = F.cat,
		dn = C.st === "dance",
		ph = C.t * 10;
	let oy,
		rot,
		fl = C.face || 1;
	if (dn) {
		oy = -Math.abs(Math.sin(ph)) * 16;
		rot = Math.sin(ph) * 0.28;
		fl = Math.sin(ph * 0.5) > 0 ? 1 : -1;
	} else if (C.st === "walk") {
		oy = -Math.abs(Math.sin(t * 12)) * 4;
		rot = 0.06 * fl;
	} else {
		oy = -Math.abs(Math.sin(t * 30)) * 6;
		rot = 0.12 * fl;
	}
	ctx.fillStyle = "rgba(0,0,0,.4)";
	ctx.beginPath();
	ctx.ellipse(C.x, C.y + 3, 20, 6, 0, 0, 7);
	ctx.fill();
	ctx.save();
	ctx.translate(C.x, C.y + oy);
	ctx.rotate(rot);
	ctx.scale(fl, 1);
	sp(CAT, 0, 0, 4);
	ctx.restore();
	ctx.font = 'bold 16px "Trebuchet MS",system-ui,sans-serif';
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.lineWidth = 4;
	ctx.strokeStyle = "#000";
	ctx.strokeText("Мафин", C.x, C.y - 70 + oy);
	ctx.fillStyle = "#ffd54f";
	ctx.fillText("Мафин", C.x, C.y - 70 + oy);
	if (dn)
		for (let k = 0; k < 3; k++) {
			const q = (C.t * 40 + k * 28) % 56;
			ctx.globalAlpha = 1 - q / 56;
			gly("note", C.x + Math.sin(C.t * 4 + k * 2) * 36, C.y - 84 - q, 14, "#ffd54f", "#000");
			ctx.globalAlpha = 1;
		}
}
const FG = {
	0: "111101101101111",
	1: "010110010010111",
	2: "111001111100111",
	3: "111001111001111",
	4: "101101111001001",
	5: "111100111001111",
	6: "111100111101111",
	7: "111001001001001",
	8: "111101111101111",
	9: "111101111001111",
	F: "111100110100100",
	P: "111101111100100",
	S: "111100111001111",
};
function fpsDraw() {
	const str = "FPS " + FV,
		k = 3,
		y = H - 28,
		w = str.length * 4 * k + 8;
	ctx.fillStyle = "rgba(0,12,0,.7)";
	ctx.fillRect(6, y - 6, w, 5 * k + 12);
	[
		["#031f03", 1],
		["#39ff14", 0],
	].forEach(([c, o]) => {
		ctx.fillStyle = c;
		let x = 10 + o;
		for (const ch of str) {
			const g = FG[ch];
			if (g) for (let i = 0; i < 15; i++) if (g[i] === "1") ctx.fillRect(x + (i % 3) * k, y + ((i / 3) | 0) * k + o, k, k);
			x += 4 * k;
		}
	});
}

const Music = (() => {
	let mg, fl, rate = 1, sfxv = 1, rc,
		master,
		pump,
		bassBus,
		leadBus,
		nb,
		pc,
		pm,
		on = true,
		vol = 1,
		want = 0,
		booting = false;
	const B = {},
		LS = {},
		TR = [0, 1].map(() => ({ bufs: [], g: null, idx: 0, nt: 0, run: false, srcs: [] }));
	const SR = 24000,
		BPM = 140,
		SPS = 60 / BPM / 4,
		mf = (m) => 440 * Math.pow(2, (m - 69) / 12);
	const CD = {
		Am: [33, [57, 60, 64, 69], [81, 79, 76]],
		F: [29, [53, 57, 60, 65], [77, 76, 72]],
		Dm: [26, [50, 53, 57, 62], [74, 77, 81]],
		E: [28, [52, 56, 59, 64], [80, 76, 83]],
		G: [31, [55, 59, 62, 67], [79, 74, 83]],
		C: [36, [52, 55, 60, 64], [76, 72, 79]],
		Bb: [34, [58, 62, 65, 70], [74, 70, 77]],
		Em: [28, [52, 55, 59, 64], [79, 76, 83]],
	};
	const BS = [
		[0, -1, -1, 0, -1, -1, 12, -1, 0, -1, -1, 0, -1, 7, -1, -1],
		[0, 0, 12, 0, 0, 0, 12, 0, 0, 0, 12, 0, 0, 7, 0, 12],
		[-1, -1, 0, -1, -1, -1, 0, -1, -1, -1, 0, -1, -1, -1, 7, -1],
		[0, 0, -1, 0, 0, -1, 0, 0, 12, 0, -1, 0, 10, -1, 12, -1],
		[0, 12, 0, 12, 0, 12, 0, 12, 0, 12, 0, 12, 7, 7, 10, 12],
	];
	const AP = [
		[0, -1, -1, -1, 1, -1, -1, -1, 2, -1, -1, -1, 3, -1, -1, -1],
		[0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 3, 2, 1, 2],
		[3, 2, 1, 0, 3, 2, 1, 0, 2, 3, 2, 1, 3, 2, 1, 0],
		[0, 2, 1, 3, 0, 2, 1, 3, 0, 2, 1, 3, 2, 3, 1, 0],
	];
	const LP = [0, [0, -1, -1, 1, -1, -1, 2, -1, -1, 1, -1, -1, 0, -1, 1, -1], [0, -1, 0, -1, 1, -1, -1, 2, -1, -1, 1, -1, 0, -1, -1, -1]];
	const PLAN = [
		[
			{ bars: 4, pr: ["Am", "F", "Dm", "E"], dr: 0, bs: 5, ar: 0, ld: 0, tp: 0.55, fx: "in" },
			{ bars: 8, pr: ["Am", "F", "C", "G", "Am", "F", "C", "G"], dr: 1, bs: 2, ar: 1, ld: 0, tp: 0.9 },
			{ bars: 4, pr: ["Dm", "Bb", "F", "E"], dr: 0, bs: 5, ar: 2, ld: 2, tp: 0.65, fx: "rise" },
			{ bars: 8, pr: ["Am", "F", "Dm", "E", "Am", "F", "Dm", "E"], dr: 2, bs: [1, 3], ar: 1, ld: 1, tp: 1.15 },
		],
		[
			{ bars: 4, pr: ["Am", "Am", "F", "E"], dr: 3, bs: 0, ar: 1, ld: 0, tp: 0.95, fx: "in" },
			{ bars: 8, pr: ["Am", "F", "C", "G", "Am", "F", "C", "E"], dr: 2, bs: [1, 4], ar: 1, ld: 1, tp: 1.25 },
			{ bars: 4, pr: ["Dm", "Bb", "E", "E"], dr: 0, bs: 5, ar: 2, ld: 2, tp: 0.7, fx: "rise" },
			{ bars: 8, pr: ["Am", "F", "Dm", "E", "Am", "G", "Dm", "E"], dr: 4, bs: [3, 4], ar: 3, ld: 1, tp: 1.3 },
			{ bars: 8, pr: ["Em", "G", "Dm", "E", "Am", "F", "Dm", "E"], dr: 5, bs: [2, 1], ar: 1, ld: 2, tp: 1.15, fx: "rise2" },
		],
	];
	PLAN.forEach((tr) => {
		let a = 0;
		tr.forEach((x) => {
			x.a = a;
			x.st = x.bars * 16;
			x.dur = x.st * SPS;
			a += x.st;
		});
	});
	function env(g, t, a, pk, dd) {
		g.gain.setValueAtTime(0.0001, t);
		g.gain.exponentialRampToValueAtTime(pk, t + a);
		g.gain.exponentialRampToValueAtTime(0.0001, t + a + dd);
	}
	function noise(t, type, f, v, dd, o) {
		const s = rc.createBufferSource();
		s.buffer = nb;
		const fl = rc.createBiquadFilter();
		fl.type = type;
		fl.frequency.value = f;
		const g = rc.createGain();
		env(g, t, 0.002, v, dd);
		s.connect(fl);
		fl.connect(g);
		g.connect(master);
		s.start(t, o === undefined ? Rand.next() * 0.4 : o);
		s.stop(t + dd + 0.05);
	}
	function kick(t, v) {
		const o = rc.createOscillator(),
			g = rc.createGain();
		o.frequency.setValueAtTime(175, t);
		o.frequency.exponentialRampToValueAtTime(40, t + 0.11);
		env(g, t, 0.002, v * 1.3, 0.42);
		o.connect(g);
		g.connect(master);
		o.start(t);
		o.stop(t + 0.47);
		noise(t, "highpass", 3000, v * 0.3, 0.012);
	}
	function tom(t, f, v) {
		const o = rc.createOscillator(),
			g = rc.createGain();
		o.frequency.setValueAtTime(f, t);
		o.frequency.exponentialRampToValueAtTime(f * 0.5, t + 0.18);
		env(g, t, 0.003, v, 0.2);
		o.connect(g);
		g.connect(master);
		o.start(t);
		o.stop(t + 0.25);
	}
	function snare(t, v) {
		noise(t, "highpass", 1800, v * 0.7, 0.17);
		noise(t, "bandpass", 1500, v * 0.6, 0.09);
		noise(t + 0.014, "bandpass", 1500, v * 0.5, 0.07);
		const o = rc.createOscillator(),
			g = rc.createGain();
		o.type = "triangle";
		o.frequency.setValueAtTime(220, t);
		o.frequency.exponentialRampToValueAtTime(110, t + 0.08);
		env(g, t, 0.002, v * 0.5, 0.1);
		o.connect(g);
		g.connect(master);
		o.start(t);
		o.stop(t + 0.15);
	}
	function bass(t, m, dd, v) {
		const f = mf(m),
			fl = rc.createBiquadFilter(),
			g = rc.createGain(),
			sg = rc.createGain(),
			o3 = rc.createOscillator();
		fl.type = "lowpass";
		fl.Q.value = 8;
		fl.frequency.setValueAtTime(2400, t);
		fl.frequency.exponentialRampToValueAtTime(180, t + dd);
		env(g, t, 0.004, v, dd);
		env(sg, t, 0.004, v * 1.5, dd);
		["sawtooth", "square", "sawtooth"].forEach((ty, k) => {
			const o = rc.createOscillator();
			o.type = ty;
			o.frequency.value = f;
			o.detune.value = k * -9;
			o.connect(fl);
			o.start(t);
			o.stop(t + dd + 0.05);
		});
		fl.connect(g);
		g.connect(bassBus);
		o3.frequency.value = f;
		o3.connect(sg);
		sg.connect(master);
		o3.start(t);
		o3.stop(t + dd + 0.05);
	}
	function lead(t, m, dd, v, sc) {
		const f = mf(m),
			fl = rc.createBiquadFilter(),
			g = rc.createGain();
		fl.type = "lowpass";
		fl.frequency.value = sc ? 3400 : 2400;
		env(g, t, 0.005, v, dd);
		["sawtooth", "square"].forEach((ty, k) => {
			const o = rc.createOscillator();
			o.type = ty;
			o.frequency.value = f;
			o.detune.setValueAtTime(sc ? -60 : k * 8 - 4, t);
			if (sc) o.detune.linearRampToValueAtTime(0, t + 0.06);
			o.connect(fl);
			o.start(t);
			o.stop(t + dd + 0.05);
		});
		fl.connect(g);
		g.connect(leadBus);
	}
	function pad(t, notes, dd, v) {
		const fl = rc.createBiquadFilter(),
			g = rc.createGain();
		fl.type = "lowpass";
		fl.frequency.setValueAtTime(500, t);
		fl.frequency.linearRampToValueAtTime(1800, t + dd * 0.5);
		g.gain.setValueAtTime(0.0001, t);
		g.gain.linearRampToValueAtTime(v, t + 0.3);
		g.gain.setValueAtTime(v, t + dd - 0.1);
		g.gain.linearRampToValueAtTime(0.0001, t + dd + 0.15);
		notes.forEach((m) =>
			[-12, 12].forEach((c) => {
				const o = rc.createOscillator();
				o.type = "sawtooth";
				o.frequency.value = mf(m);
				o.detune.value = c;
				o.connect(fl);
				o.start(t);
				o.stop(t + dd + 0.2);
			}),
		);
		fl.connect(g);
		g.connect(pump);
	}
	function riser(t, len) {
		const s = rc.createBufferSource();
		s.buffer = nb;
		s.loop = true;
		const fl = rc.createBiquadFilter(),
			g = rc.createGain();
		fl.type = "highpass";
		fl.frequency.setValueAtTime(400, t);
		fl.frequency.exponentialRampToValueAtTime(6000, t + len);
		g.gain.setValueAtTime(0.0001, t);
		g.gain.exponentialRampToValueAtTime(0.3, t + len);
		g.gain.setValueAtTime(0.0001, t + len + 0.01);
		s.connect(fl);
		fl.connect(g);
		g.connect(master);
		s.start(t, 0);
		s.stop(t + len + 0.02);
	}
	function sched(s, t, h, sec) {
		const bi = (s >> 4) - (sec.a >> 4),
			i = s & 15,
			nbr = sec.bars,
			last = bi === nbr - 1,
			c = CD[sec.pr[bi]],
			fx = sec.fx || "";
		let dm = sec.dr;
		if (dm === 3) dm = bi < 1 ? 8 : 1;
		if (dm === 5) dm = bi < 4 ? 6 : 2;
		const gap = fx === "rise" && last && i >= 12;
		if (dm === 1 || dm === 2 || dm === 4) {
			if (i % 4 === 0) {
				kick(t, dm === 1 ? 0.8 : 1);
				pump.gain.setValueAtTime(dm === 1 ? 0.5 : 0.2, t);
				pump.gain.linearRampToValueAtTime(1, t + SPS * 3.2);
			} else if (dm >= 2 && (i === 10 || (dm === 4 && i === 6) || (bi % 4 === 3 && i === 14))) kick(t, 0.6);
		} else if (dm === 6 && (i === 0 || i === 10)) {
			kick(t, 1);
			pump.gain.setValueAtTime(0.3, t);
			pump.gain.linearRampToValueAtTime(1, t + SPS * 3.2);
		}
		if ((dm === 1 || dm === 2 || dm === 4) && (i === 4 || i === 12) && !(last && i === 12 && dm >= 2)) snare(t, dm === 1 ? 0.45 : 0.9);
		if (dm === 6 && i === 8) snare(t, 0.9);
		if (dm === 4 && i === 15 && bi % 2) snare(t, 0.25);
		if (dm === 8) {
			if (i % 4 === 0) noise(t, "highpass", 7500, 0.06, 0.05);
		} else if (dm === 1 || dm === 6) {
			if (i % 2 === 0) noise(t, "highpass", 7500, i % 4 === 2 ? 0.18 : 0.09, i % 4 === 2 ? 0.1 : 0.04);
		} else if (dm >= 2) noise(t, "highpass", 7500, i % 4 === 2 ? 0.3 : i % 2 ? 0.07 : 0.13, i % 4 === 2 ? 0.14 : 0.04);
		if (i === 0 && bi % 4 === 0 && !(fx === "in" && bi === 0)) noise(t, "highpass", 5000, 0.2 + (dm >= 2 ? 0.2 : 0), 1.4, 0);
		if (last && i >= 8 && i % 2 === 0 && (dm >= 1 || fx === "rise")) snare(t, 0.3 + i * 0.04);
		if (last && i >= 12 && (dm >= 2 || fx === "rise")) tom(t, [230, 190, 150, 120][i - 12], 0.5);
		if (fx.startsWith("rise") && bi === nbr - 2 && i === 0) riser(t, SPS * 32);
		const bp = Array.isArray(sec.bs) ? sec.bs[(bi >> 2) % sec.bs.length] : sec.bs;
		if (!gap) {
			if (bp === 5) {
				if (i === 0) bass(t, c[0], SPS * 15.5, 0.5);
			} else {
				const n = BS[bp][i];
				if (n >= 0) bass(t, c[0] + n, SPS * (bp === 2 ? 1.2 : 0.92), h ? 1 : 0.8);
			}
		}
		if (i === 0) pad(t, c[1].slice(0, 3), SPS * 16, dm ? 0.03 : 0.06);
		if (!gap) {
			const k = AP[sec.ar][i];
			if (k >= 0) lead(t, c[1][k] + (sec.ar === 3 && i >= 8 ? 12 : 0), SPS * (sec.ar === 0 ? 3 : 0.8), sec.ar === 0 ? 0.05 : 0.035, 0);
		}
		if (sec.ld && !gap) {
			const k = LP[sec.ld === 2 || bi & 1 ? 2 : 1][i];
			if (k >= 0) lead(t, c[2][k] + (sec.ld === 1 && bi >= nbr / 2 ? -12 : 0), SPS * (sec.ld === 2 ? 3 : 1.8), 0.08, 1);
		}
	}
	async function renderSec(h, sec) {
		const L = Math.round(sec.st * SPS * SR),
			O = window.OfflineAudioContext || window.webkitOfflineAudioContext,
			oc = new O(1, L + 2 * SR, SR);
		rc = oc;
		master = oc.createGain();
		master.connect(oc.destination);
		pump = oc.createGain();
		pump.gain.value = 1;
		pump.connect(master);
		nb = oc.createBuffer(1, SR, SR);
		const nd = nb.getChannelData(0);
		for (let i = 0; i < SR; i++) nd[i] = Rand.next() * 2 - 1;
		const ws = oc.createWaveShaper(),
			cu = new Float32Array(1024);
		for (let i = 0; i < 1024; i++) cu[i] = Math.tanh((i / 512 - 1) * 10);
		ws.curve = cu;
		bassBus = oc.createGain();
		bassBus.gain.value = 1.8;
		const wg = oc.createGain();
		wg.gain.value = 0.9;
		bassBus.connect(ws);
		ws.connect(wg);
		wg.connect(pump);
		leadBus = oc.createGain();
		leadBus.connect(pump);
		const dl = oc.createDelay(1),
			lp = oc.createBiquadFilter();
		lp.frequency.value = 2500;
		dl.delayTime.value = SPS * 3;
		const fb = oc.createGain();
		fb.gain.value = 0.42;
		const dg = oc.createGain();
		dg.gain.value = 0.45;
		leadBus.connect(dl);
		dl.connect(lp);
		lp.connect(fb);
		fb.connect(dl);
		dl.connect(dg);
		dg.connect(pump);
		for (let s = 0; s < sec.st; s++) sched(sec.a + s, s * SPS, h, sec);
		const o = await oc.startRendering(),
			dt = o.getChannelData(0);
		let pk = 0;
		for (let i = 0; i < dt.length; i++) {
			const q = Math.abs(dt[i]);
			if (q > pk) pk = q;
		}
		const k = pk > 0 ? sec.tp / pk : 1,
			out = pc.createBuffer(1, dt.length, SR),
			od = out.getChannelData(0);
		for (let i = 0; i < dt.length; i++) od[i] = Math.tanh(dt[i] * k) * 0.9;
		return out;
	}
	function tick() {
		if (!pc) return;
		const now = pc.currentTime;
		TR.forEach((r, h) => {
			if (!r.run) return;
			const n = PLAN[h].length;
			let g = 0;
			while (r.nt < now + 1.5 && g++ < 4) {
				const b = r.bufs[r.idx % n];
				if (!b) break;
				const s = pc.createBufferSource();
				s.buffer = b;
				s.playbackRate.value = rate;
				s.connect(r.g);
				const st = Math.max(r.nt, now + 0.03);
				s.start(st);
				r.srcs.push(s);
				s.onended = () => {
					r.srcs = r.srcs.filter((x) => x !== s);
				};
				r.nt = st + PLAN[h][r.idx % n].dur / rate;
				r.idx++;
			}
		});
	}
	function apply() {
		if (!pc) return;
		const T = pc.currentTime;
		TR.forEach((r, h) => {
			if (h === want && !r.run) {
				r.run = true;
				r.idx = 0;
				r.nt = 0;
				r.g.gain.cancelScheduledValues(T);
				r.g.gain.setValueAtTime(0, T);
				r.g.gain.setTargetAtTime(1, T, 0.04);
			} else if (h !== want && r.run) {
				r.run = false;
				r.g.gain.cancelScheduledValues(T);
				r.g.gain.setTargetAtTime(0, T, 0.12);
				const ss = r.srcs;
				r.srcs = [];
				Timers.after(
					900,
					() =>
						ss.forEach((x) => {
							try {
								x.stop();
							} catch (e) {}
						}),
					"audio",
				);
			}
		});
	}
	function mk(dd, fn) {
		const n = (dd * 22050) | 0,
			b = pc.createBuffer(1, n, 22050),
			x = b.getChannelData(0),
			s = { p: 0, l: 0 };
		for (let i = 0; i < n; i++) x[i] = fn(i / 22050, s) || 0;
		return b;
	}
	const sw = (s, f) => {
			s.p += (6.2832 * f) / 22050;
			return Math.sin(s.p);
		},
		rd = () => Rand.next() * 2 - 1;
	function bank() {
		B.click = mk(0.05, (t, s) => sw(s, 1100) * Math.exp(-t * 70) * 0.5);
		B.hit = mk(0.22, (t, s) => (sw(s, 60 + 200 * Math.exp(-t * 25)) * 0.9 + rd() * 0.7 * Math.exp(-t * 60)) * Math.exp(-t * 13));
		B.zap = mk(0.2, (t, s) => (sw(s, 900 - 2800 * t) * 0.5 + rd() * 0.15) * Math.exp(-t * 14));
		B.heal = mk(0.4, (t, s) => sw(s, [660, 880, 1175, 1568][Math.min(3, (t * 14) | 0)]) * 0.35 * Math.exp(-(t % 0.07) * 12) * (1 - t / 0.4));
		B.die = mk(0.5, (t, s) => {
			s.l += (rd() - s.l) * (0.5 - t) * 0.5;
			return (sw(s, 200 * Math.exp(-t * 5) + 30) * 0.5 + s.l * 0.9) * Math.exp(-t * 5);
		});
		B.coin = mk(0.28, (t, s) => Math.sign(sw(s, t < 0.07 ? 988 : 1319)) * 0.25 * Math.exp(-(t < 0.07 ? t : t - 0.07) * 14));
		B.err = mk(0.2, (t, s) => Math.sign(sw(s, t < 0.1 ? 160 : 130)) * 0.3 * (t % 0.1 < 0.08 ? 1 : 0) * Math.exp(-t * 4));
		B.win = mk(0.8, (t, s) => Math.sign(sw(s, [440, 554, 659, 880][Math.min(3, (t * 6) | 0)])) * 0.28 * Math.exp(-(t % 0.1667) * 5) * (1 - t / 0.8));
		B.lose = mk(0.8, (t, s) => ((sw(s, 320 * Math.exp(-t * 2.2) + 50) > 0 ? 1 : -1) * 0.3 + rd() * 0.1) * (1 - t / 0.8));
		B.boom = mk(0.6, (t, s) => (sw(s, 40 + 120 * Math.exp(-t * 12)) + rd() * 0.5 * Math.exp(-t * 25)) * Math.exp(-t * 6));
	}
	return {
		async start() {
			if (pc || booting) return;
			booting = true;
			const A = window.AudioContext || window.webkitAudioContext;
			if (!A || !(window.OfflineAudioContext || window.webkitOfflineAudioContext)) return;
			try {
				pc = new A();
				pm = pc.createGain();
				pm.gain.value = 0.8;
				pm.connect(pc.destination);
				mg = pc.createGain();
				mg.gain.value = on ? vol : 0;
				fl = pc.createBiquadFilter();
				fl.type = "lowpass";
				fl.frequency.value = 20000;
				mg.connect(fl);
				fl.connect(pm);
				TR.forEach((r) => {
					r.g = pc.createGain();
					r.g.gain.value = 0;
					r.g.connect(mg);
				});
				pc.resume().catch(() => {});
				bank();
				apply();
				Timers.every(120, tick, "audio");
				for (let h = 0; h < 2; h++) for (let i = 0; i < PLAN[h].length; i++) TR[h].bufs[i] = await renderSec(h, PLAN[h][i]);
			} catch (e) {
				console.warn(e);
			}
		},
		set sfxv(v) {
			sfxv = v;
		},
		tune(r, f) {
			rate = r;
			if (fl) fl.frequency.setTargetAtTime(f, pc.currentTime, 0.4);
		},
		ext(f) {
			if (pc) f(B, mk, sw, rd);
		},
		wake() {
			if (pc && pc.state !== "running" && !paused && !document.hidden) pc.resume().catch(() => {});
		},
		sfx(n, v = 1) {
			if (!pc || !B[n] || pc.state !== "running") return;
			const T = pc.currentTime;
			if (T - (LS[n] || -1) < 0.045) return;
			LS[n] = T;
			const s = pc.createBufferSource(),
				g = pc.createGain();
			s.buffer = B[n];
			s.playbackRate.value = n === "click" ? 1 : 0.92 + Rand.next() * 0.16;
			g.gain.value = v * 0.9 * sfxv;
			s.connect(g);
			g.connect(pm);
			s.start();
		},
		level(v) {
			if (v === want) return;
			want = v;
			apply();
		},
		pause(p) {
			if (pc) p ? pc.suspend() : pc.resume();
		},
		toggle() {
			on = !on;
			if (mg) mg.gain.setTargetAtTime(on ? vol : 0, pc.currentTime, 0.05);
		},
		get on() {
			return on;
		},
		get vol() {
			return vol;
		},
		cfg(o, v) {
			on = !!o;
			vol = v;
		},
		setVol(v) {
			vol = v;
			if (mg) mg.gain.setTargetAtTime(on ? vol : 0, pc.currentTime, 0.05);
		},
	};
})();

