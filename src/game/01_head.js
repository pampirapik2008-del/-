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
function forest(dark, clr, B, gl) {
	const K = 3,
		w = Math.ceil(W / K),
		h = H / K,
		c = document.createElement("canvas");
	c.width = w;
	c.height = h;
	const x = c.getContext("2d"),
		V = (i, j, col) => {
			x.fillStyle = col;
			x.fillRect(i | 0, j | 0, 1, 1);
		};
	const P = B ? B.P : dark ? ["#031009", "#05221a", "#0a3328", "#12503f"] : ["#0a4a3a", "#0e6a52", "#15876a", "#2cae85"];
	x.fillStyle = B ? B.bg : dark ? "#020d0a" : "#02261d";
	x.fillRect(0, 0, w, h);
	if (gl)
		gl.forEach((g) => {
			const a = g.x / K,
				b = g.y / K,
				rx = g.rx / K,
				ry = g.ry / K;
			[
				[1.2, B.P[1]],
				[1.07, B.rim],
				[1, B.lake],
			].forEach(([m, q]) => {
				x.fillStyle = q;
				x.beginPath();
				x.ellipse(a, b, rx * m, ry * m, 0, 0, 7);
				x.fill();
			});
			for (let i = 0; i < 22; i++) {
				const q = rn() * 6.28,
					d = Math.sqrt(rn()) * 0.85;
				V(a + Math.cos(q) * rx * d, b + Math.sin(q) * ry * d, B.hi);
			}
		});

	let cx = -99,
		cy = -99,
		cw = 0,
		ch = 0;
	if (clr) {
		cx = (clr.x / K) | 0;
		cy = (clr.y / K) | 0;
		cw = (clr.w / K) | 0;
		ch = (clr.h / K) | 0;
		const mid = cx + 103;
		for (let j = cy; j < cy + ch; j++) {
			const ed = mid + Math.round(Math.sin(j * 0.35) * 3 + rn() * 2 - 1);
			for (let i = cx; i < cx + cw; i++) {
				const g = i < ed,
					n = rn();
				V(
					i,
					j,
					Math.abs(i - ed) < 2 && n < 0.6
						? g
							? "#2f8a5c"
							: "#6e4421"
						: g
							? n < 0.1
								? "#2f8a5c"
								: n < 0.3
									? "#46a874"
									: n < 0.45
										? "#52b680"
										: "#3f9a69"
							: n < 0.1
								? "#6e4421"
								: n < 0.3
									? "#7a4d26"
									: n < 0.5
										? "#8b5a2e"
										: "#946336",
				);
			}
		}
		const gx = () => (cx + rn() * 100) | 0,
			dx = () => (cx + 106 + rn() * (cw - 108)) | 0,
			yy = () => (cy + rn() * ch) | 0;
		for (let i = 0; i < 60; i++) {
			const a = gx(),
				b = yy();
			V(a, b, "#8fe0aa");
			V(a, b + 1, "#8fe0aa");
			V(a + 1, b + 1, "#2c7a52");
		}
		for (let i = 0; i < 16; i++) V(gx(), yy(), ["#ff5252", "#ffd54f", "#fff", "#ce93d8"][(rn() * 4) | 0]);
		for (let i = 0; i < 7; i++) {
			const a = gx(),
				b = yy();
			x.fillStyle = "#8a929c";
			x.fillRect(a, b, 3, 2);
			V(a, b, "#c5ccd4");
			x.fillStyle = "#4c525a";
			x.fillRect(a + 1, b + 2, 3, 1);
		}
		for (let i = 0; i < 22; i++) {
			const a = dx(),
				b = yy();
			x.fillStyle = "#a07a50";
			x.fillRect(a, b, 2, 1);
			V(a, b + 1, "#5a3716");
		}
		for (let i = 0; i < 9; i++) {
			let a = dx(),
				b = yy();
			for (let k = 0; k < 7; k++) {
				V(a, b, "#5a3716");
				a += rn() < 0.5 ? 1 : 0;
				b += rn() < 0.5 ? 1 : -1;
			}
		}
		x.fillStyle = "rgba(255,255,255,.07)";
		x.fillRect(127, 67, 57, 40);
		x.strokeStyle = "rgba(255,255,255,.2)";
		x.strokeRect(127.5, 67.5, 57, 40);
	}
	for (let j = -4; j < h + 12; j += 5)
		for (let i = -6; i < w + 6; i += 9) {
			const px = i + ((rn() * 5) | 0),
				py = j + ((rn() * 3) | 0);
			if (clr && px > cx - 2 && px < cx + cw + 2 && py > cy + 4 && py < cy + ch + 9) continue;
			if (gl && gl.some((g) => ((px * K - g.x) / (g.rx * 1.1)) ** 2 + ((py * K - g.y) / (g.ry * 1.3)) ** 2 < 1)) continue;
			for (let k = 0; k < 3; k++)
				for (let r = 0; r < 6; r++) {
					const wd = 1 + Math.floor((r + k * 2) * 0.8),
						y2 = py - 15 + k * 4 + r;
					for (let q = -wd; q <= wd; q++) {
						x.fillStyle = r >= 5 ? P[0] : q < -wd + 1 ? P[3] : q < 0 ? P[2] : P[1];
						x.fillRect(px + q, y2, 1, 1);
					}
				}
			x.fillStyle = P[0];
			x.fillRect(px, py - 1, 2, 3);
		}
	const f = document.createElement("canvas");
	f.width = W;
	f.height = H;
	const y = f.getContext("2d");
	y.imageSmoothingEnabled = false;
	y.drawImage(c, 0, 0, w * K, h * K);
	const g = y.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
	g.addColorStop(0, "rgba(0,0,0,0)");
	g.addColorStop(1, "rgba(0,0,0,.85)");
	y.fillStyle = g;
	y.fillRect(0, 0, W, H);
	return f;
}
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
const NC = { tribe: "#ffb74d", swamp: "#9ccc65", arena: "#ff7a7a", barr: "#90a4ae", mine: "#ffd54f" };
let mapBG = document.createElement("canvas"),
	BIOME = BIOMES[0],
	GL = [],
	SD = 7,
	BI = 0;
const fightBG = null;
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
const UA = new Image();
let UR = 0;
const UI = {
	win: [0, 0, 593, 349],
	bt: { n: [250, 493, 249, 90], p: [597, 493, 249, 86], d: [0, 587, 248, 86], g: [364, 351, 247, 94], r: [0, 493, 248, 92] },
	ic: {
		note: [337, 587, 85, 84],
		pause: [250, 587, 85, 85],
		ff: [424, 587, 82, 84],
		cart: [508, 587, 82, 84],
		x: [592, 587, 83, 84],
		cell: [138, 351, 121, 123],
		cells: [0, 351, 136, 140],
		card: [595, 0, 178, 174],
		coin: [613, 351, 88, 93],
		meat: [501, 493, 94, 89],
		skull: [261, 351, 101, 97],
	},
};
UA.onload = () => {
	UR = 1;
};
function nine(r, x, y, w, h, cs, dc) {
	const sx = r[0],
		sy = r[1],
		sw = r[2],
		sh = r[3];
	dc = Math.min(dc, w / 2, h / 2);
	const xs = [0, cs, sw - cs, sw],
		ys = [0, cs, sh - cs, sh],
		xd = [x, x + dc, x + w - dc, x + w],
		yd = [y, y + dc, y + h - dc, y + h];
	for (let j = 0; j < 3; j++)
		for (let i = 0; i < 3; i++)
			ctx.drawImage(UA, sx + xs[i], sy + ys[j], xs[i + 1] - xs[i], ys[j + 1] - ys[j], xd[i], yd[j], xd[i + 1] - xd[i], yd[j + 1] - yd[j]);
}
const SCAN = (() => {
	const c = document.createElement("canvas");
	c.width = 4;
	c.height = 3;
	const x = c.getContext("2d");
	x.fillStyle = "rgba(0,0,0,.08)";
	x.fillRect(0, 0, 4, 1);
	return ctx.createPattern(c, "repeat");
})();
const ST = Array.from({ length: 60 }, () => [rn() * W, rn() * 330, rn() * 6]);
function fireflies(c = "255,240,120") {
	for (let i = 0; i < 16; i++) {
		const a = t * 0.4 + i * 7.3,
			x = (i * 97 + Math.sin(a) * 50 + W) % W,
			y = ((i * 53) % H) + Math.cos(a * 1.3) * 30,
			al = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.6 + i));
		ctx.fillStyle = "rgba(" + c + "," + al * 0.8 + ")";
		ctx.fillRect(x | 0, y | 0, 3, 3);
		ctx.fillStyle = "rgba(" + c + "," + al * 0.2 + ")";
		ctx.fillRect((x | 0) - 2, (y | 0) - 2, 7, 7);
	}
}
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
function mbtn(x, y, w, h, q, f, c, dis) {
	const cx = x + w / 2,
		cy = y + h / 2 + Math.sin(t * 2 + y * 0.05) * 1.6;
	ctx.font = 'bold 28px "Trebuchet MS",system-ui,sans-serif';
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.lineJoin = "round";
	ctx.lineWidth = 7;
	ctx.strokeStyle = "#000";
	ctx.strokeText(q, cx, cy);
	ctx.fillStyle = dis ? "#333" : c;
	ctx.fillText(q, cx + 2, cy + 3);
	ctx.fillStyle = dis ? "#8a8a95" : "#fff";
	ctx.fillText(q, cx, cy);
	area(x, y, w, h, f);
}
function ctl(e) {
	const A = N[e[0]],
		B = N[e[1]],
		dx = B.x - A.x,
		dy = B.y - A.y,
		l = Math.hypot(dx, dy) || 1,
		bd = 0;
	return [(A.x + B.x) / 2 - (dy / l) * bd, (A.y + B.y) / 2 + (dx / l) * bd];
}
function bzp(a, b, p) {
	const e = E.find((e) => (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a));
	if (!e) return [N[a].x + (N[b].x - N[a].x) * p, N[a].y + (N[b].y - N[a].y) * p];
	const A = N[e[0]],
		B = N[e[1]],
		cc = ctl(e),
		q = e[0] === a ? p : 1 - p,
		u = 1 - q;
	return [u * u * A.x + 2 * u * q * cc[0] + q * q * B.x, u * u * A.y + 2 * u * q * cc[1] + q * q * B.y];
}
function lakes() {
	GL.forEach((g, i) => {
		ctx.strokeStyle = "rgba(255,255,255," + (0.14 + 0.1 * Math.sin(t * 1.5 + i)) + ")";
		ctx.lineWidth = 2;
		for (let k = 0; k < 3; k++) {
			const a = g.rx * (0.35 + 0.15 * k),
				y = g.y + (k - 1) * g.ry * 0.45,
				o = Math.sin(t * 0.8 + k + i) * g.rx * 0.12;
			ctx.beginPath();
			ctx.moveTo(g.x - a + o, y);
			ctx.lineTo(g.x + a * 0.6 + o, y);
			ctx.stroke();
		}
	});
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
function plaque() {
	ctx.fillStyle = "rgba(8,6,14,.62)";
	ctx.fillRect(12, 10, 196, 40);
	ctx.fillStyle = BIOME.rim;
	ctx.fillRect(12, 10, 4, 40);
	tx(BIOME.n, 26, 24, 16, "#fff", "left", true);
	tx("Шагов пройдено: " + G.depth, 26, 41, 13, "#cfd8dc");
}
const WH = new Map();
function white(c) {
	let w = WH.get(c);
	if (!w) {
		w = document.createElement("canvas");
		w.width = w.height = 16;
		const x = w.getContext("2d");
		x.drawImage(c, 0, 0);
		x.globalCompositeOperation = "source-atop";
		x.fillStyle = "#fff";
		x.fillRect(0, 0, 16, 16);
		WH.set(c, w);
	}
	return w;
}
const UB = new Image();
let UR2 = 0;
const ANI = {
		mage: {
			k: 0.5,
			idle: [
				[381, 562, 127, 137, 52.0, 136.0],
				[738, 562, 118, 136, 50.0, 135.0],
				[510, 562, 112, 137, 45.0, 136.0],
			],
			walk: [
				[986, 562, 83, 133, 39.0, 132.0],
				[1071, 562, 80, 133, 42.0, 132.0],
				[1153, 562, 87, 133, 43.0, 132.0],
				[132, 712, 85, 132, 35.0, 132.0],
			],
			hurt: [721, 712, 82, 130, 37.0, 134.0],
			atk: [
				[811, 0, 119, 172, 41.0, 172.0],
				[858, 562, 126, 135, 32.0, 135.0],
				[470, 712, 134, 131, 51.0, 132.0],
				[519, 847, 92, 124, 41.0, 125.0],
				[606, 712, 113, 131, 44.0, 132.0],
			],
			fx: null,
		},
		bandit: {
			k: 0.5,
			idle: [
				[0, 712, 130, 133, 57.0, 132.0],
				[219, 712, 118, 132, 51.0, 131.0],
			],
			walk: [
				[122, 847, 104, 129, 48.0, 128.0],
				[805, 712, 84, 130, 45.0, 129.0],
				[891, 712, 80, 130, 43.0, 130.0],
				[228, 847, 87, 129, 47.0, 129.0],
			],
			hurt: [317, 847, 87, 129, 46.0, 129.0],
			atk: [
				[339, 712, 129, 132, 46.0, 132.0],
				[973, 712, 205, 130, 63.0, 130.0],
				[613, 847, 219, 121, 55.0, 126.0],
				[406, 847, 111, 128, 46.0, 126.0],
			],
			fx: null,
		},
		knight: {
			k: 0.44,
			idle: [
				[1155, 0, 116, 153, 55.0, 152.0],
				[197, 257, 114, 150, 58.0, 149.0],
			],
			walk: [
				[0, 257, 114, 152, 64.0, 151.0],
				[0, 562, 91, 148, 51.0, 147.0],
				[116, 257, 79, 151, 41.0, 150.0],
				[93, 562, 89, 146, 44.0, 144.0],
			],
			hurt: [296, 562, 83, 143, 39.0, 141.0],
			atk: [
				[932, 0, 112, 166, 40.0, 165.0],
				[1046, 0, 107, 166, 50.0, 165.0],
				[624, 562, 112, 137, 51.0, 136.0],
				[0, 847, 120, 130, 48.0, 129.0],
				[184, 562, 110, 145, 52.0, 144.0],
			],
			fx: [834, 847, 96, 121, 59.0, 192.0],
		},
	},
	PORT = { mage: [266, 0, 260, 240], bandit: [528, 0, 281, 237], knight: [0, 0, 264, 255] },
	BNR = [0, 411, 1210, 149];
UB.onload = () => {
	UR2 = 1;
};
HEROES[0].k = "mage";
HEROES[1].k = "knight";
HEROES[3].k = "bandit";
function drawAni(u, s, mv) {
	const A = ANI[u.k],
		k = (A.k * s) / 4,
		sm = ctx.imageSmoothingEnabled;
	ctx.imageSmoothingEnabled = true;
	let f;
	if (u.hitT > 0) f = A.hurt;
	else if (u.atkT > 0) {
		const p = 1 - u.atkT / 0.22;
		f = A.atk[Math.min(A.atk.length - 1, (p * A.atk.length) | 0)];
		if (A.fx && p > 0.25 && p < 0.75) {
			const q = A.fx;
			ctx.drawImage(UB, q[0], q[1], q[2], q[3], q[4] * k, -q[5] * k + s * 1.5, q[2] * k, q[3] * k);
		}
	} else if (mv) f = A.walk[((t * 10) | 0) % A.walk.length];
	else f = A.idle[(((t + u.ph) * 3) | 0) % A.idle.length];
	ctx.drawImage(UB, f[0], f[1], f[2], f[3], -f[4] * k, -f[5] * k + s * 1.5, f[2] * k, f[3] * k);
	ctx.imageSmoothingEnabled = sm;
}
function spu(u, x, y, s) {
	if (UR2 && u.k && PORT[u.k]) {
		const r = PORT[u.k],
			z = (s * 13) / Math.max(r[2], r[3]),
			sm = ctx.imageSmoothingEnabled;
		ctx.imageSmoothingEnabled = true;
		ctx.drawImage(UB, r[0], r[1], r[2], r[3], x - (r[2] * z) / 2, y - 6 * s - (r[3] * z) / 2, r[2] * z, r[3] * z);
		ctx.imageSmoothingEnabled = sm;
	} else sp(u.spr, x, y, s);
}
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
function wrapT(q, x, y, w, lh, sz, c, b) {
	ctx.font = (b ? "bold " : "") + sz + 'px "Trebuchet MS",system-ui,sans-serif';
	ctx.fillStyle = c;
	ctx.textAlign = "left";
	ctx.textBaseline = "middle";
	let line = "";
	for (const wd of q.split(" ")) {
		const tt = line ? line + " " + wd : wd;
		if (ctx.measureText(tt).width > w && line) {
			ctx.fillText(line, x, y);
			y += lh;
			line = wd;
		} else line = tt;
	}
	ctx.fillText(line, x, y);
	return y + lh;
}
function hexP(cx, cy, r) {
	ctx.beginPath();
	for (let i = 0; i < 6; i++) {
		const a = -Math.PI / 2 + (i * Math.PI) / 3;
		ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
	}
	ctx.closePath();
}
function shIcon(it, cx, cy) {
	const R_ = (x, y, w, h, c) => {
		ctx.fillStyle = c;
		ctx.fillRect(x | 0, y | 0, w, h);
	};
	if (it.v === "b") {
		hexP(cx, cy, 30);
		ctx.fillStyle = "#2a2830";
		ctx.fill();
		ctx.strokeStyle = "#4b4a55";
		ctx.lineWidth = 3;
		ctx.stroke();
		hexP(cx, cy, 23);
		ctx.strokeStyle = "#14131a";
		ctx.lineWidth = 2;
		ctx.stroke();
		gly(it.k, cx, cy, 26, "#ffa726", "#14131a");
	} else if (it.v === "p") {
		R_(cx - 20, cy - 14, 40, 34, "#000");
		R_(cx - 5, cy - 24, 10, 8, "#8b5a2b");
		R_(cx - 8, cy - 17, 16, 5, "#cfe6ea");
		R_(cx - 17, cy - 11, 34, 29, "#e6f3f5");
		R_(cx - 14, cy - 4, 28, 20, "#e53935");
		R_(cx - 14, cy - 4, 28, 4, "#ff6f60");
		R_(cx - 10, cy + 2, 5, 5, "#ff8a80");
	} else if (it.v === "k") {
		ctx.fillStyle = "#3d424c";
		ctx.beginPath();
		ctx.arc(cx, cy, 24, 0, 7);
		ctx.fill();
		ctx.fillStyle = "#8d949f";
		ctx.beginPath();
		ctx.arc(cx, cy, 20, 0, 7);
		ctx.fill();
		ctx.strokeStyle = "#5b626d";
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.arc(cx, cy, 15, 0, 7);
		ctx.stroke();
		gly("skull", cx, cy, 22, "#eceff4", "#2a2d33");
	} else if (it.v === "s") {
		ctx.save();
		ctx.translate(cx, cy);
		ctx.rotate(-0.15);
		R_(-22, -16, 40, 32, "#f1ece0");
		R_(-22, -16, 40, 4, "#fff");
		ctx.strokeStyle = "#d32f2f";
		ctx.lineWidth = 4;
		ctx.beginPath();
		ctx.moveTo(-12, -8);
		ctx.lineTo(8, 10);
		ctx.moveTo(8, -8);
		ctx.lineTo(-12, 10);
		ctx.stroke();
		R_(14, -12, 6, 28, "#d9b36c");
		ctx.restore();
	} else {
		ctx.fillStyle = "#4a1f12";
		ctx.beginPath();
		ctx.ellipse(cx, cy, 23, 17, -0.3, 0, 7);
		ctx.fill();
		ctx.fillStyle = "#c0583f";
		ctx.beginPath();
		ctx.ellipse(cx, cy, 20, 14, -0.3, 0, 7);
		ctx.fill();
		R_(cx - 12, cy - 6, 7, 5, "#e88b74");
		R_(cx + 14, cy - 9, 9, 9, "#f1ece0");
	}
}
function stall() {
	const R_ = (x, y, w, h, c) => {
			ctx.fillStyle = c;
			ctx.fillRect(x | 0, y | 0, w, h);
		},
		cx = 282,
		bob = Math.sin(t * 3);
	R_(196, 142, 118, 5, "#5a3a1a");
	R_(196, 147, 118, 36, "#8b5a2b");
	R_(196, 147, 118, 3, "#a8743a");
	[
		[200, "#d9c39a"],
		[238, "#e3d1ab"],
		[276, "#d9c39a"],
	].forEach(([x, c], i) => {
		const sw = Math.sin(t * 1.3 + i);
		R_(x, 151 + sw, 34, 28, c);
		R_(x, 151 + sw, 34, 2, "#f2e6c8");
		ctx.strokeStyle = "#a68a5b";
		ctx.lineWidth = 2;
		ctx.beginPath();
		if (i == 0) ctx.arc(x + 17, 165 + sw, 7, 0, 7);
		else if (i == 1) {
			ctx.moveTo(x + 6, 170 + sw);
			ctx.lineTo(x + 14, 158 + sw);
			ctx.lineTo(x + 22, 170 + sw);
			ctx.lineTo(x + 28, 160 + sw);
		} else ctx.rect(x + 8, 158 + sw, 18, 12);
		ctx.stroke();
	});
	R_(304, 184, 50, 68, "#1f6b78");
	R_(308, 188, 36, 60, "#0f2b31");
	[0, 1, 2].forEach((i) => {
		R_(308, 188 + i * 20 + 18, 36, 2, "#2f8f9a");
		R_(312, 188 + i * 20 + 6, 6, 10, ["#ffd54f", "#8bc34a", "#ff8a65"][i]);
		R_(322, 188 + i * 20 + 9, 8, 7, ["#8bc34a", "#ffb74d", "#ffd54f"][i]);
		R_(334, 188 + i * 20 + 8, 6, 8, ["#ef5350", "#fff59d", "#81c784"][i]);
	});
	R_(344, 186, 10, 64, "#4fb3c3");
	R_(344, 186, 3, 64, "#7fd3e0");
	ctx.fillStyle = "#8e44ad";
	ctx.beginPath();
	ctx.ellipse(246, 236, 17, 15, 0, 0, 7);
	ctx.fill();
	R_(238, 232, 5, 5, "#c39bd3");
	R_(250, 240, 5, 5, "#c39bd3");
	R_(242, 226, 4, 4, "#c39bd3");
	ctx.fillStyle = "#4caf50";
	ctx.beginPath();
	ctx.arc(232, 212, 11, 0, 7);
	ctx.fill();
	R_(227, 207, 4, 4, "#a5d6a7");
	ctx.fillStyle = "#2f6fd0";
	ctx.beginPath();
	ctx.arc(214, 240, 16, 0, 7);
	ctx.fill();
	R_(207, 232, 6, 6, "#8ab8ff");
	R_(218, 243, 12, 5, "#e8f1ff");
	R_(cx - 20, 252, 40, 14, "#3b3b44");
	ctx.fillStyle = "#2a2a31";
	ctx.beginPath();
	ctx.moveTo(cx - 24, 228 + bob);
	ctx.lineTo(cx + 24, 228 + bob);
	ctx.lineTo(cx + 2, 198 + bob);
	ctx.lineTo(cx - 2, 198 + bob);
	ctx.closePath();
	ctx.fill();
	R_(cx - 32, 226 + bob, 64, 6, "#3a3a44");
	R_(cx - 24, 222 + bob, 48, 4, "#b71c1c");
	R_(cx - 15, 232 + bob, 30, 20, "#15151a");
	if (Math.sin(t * 1.7) < 0.96) {
		ctx.save();
		ctx.shadowColor = "#ff2b2b";
		ctx.shadowBlur = QL.lv === 0 ? 0 : 8 * R; // на низком качестве размытие тени выключено
		R_(cx - 10, 240 + bob, 7, 4, "#ff4040");
		R_(cx + 3, 240 + bob, 7, 4, "#ff4040");
		ctx.restore();
	}
	R_(200, 262, 146, 34, "#a89a86");
	R_(200, 262, 146, 4, "#c9bca6");
	for (let i = 0; i < 15; i++) R_(200 + i * 10, 296, 8, 3 + ((i * 7) % 5), "#a89a86");
	R_(206, 297, 6, 10, "#5a4a3a");
	R_(334, 297, 6, 10, "#5a4a3a");
	for (let i = 0; i < 4; i++) {
		ctx.fillStyle = "#d4a017";
		ctx.beginPath();
		ctx.ellipse(214 + i * 8, 258 - (i % 2) * 3, 7, 3, 0, 0, 7);
		ctx.fill();
		R_(210 + i * 8, 256 - (i % 2) * 3, 8, 2, "#ffd54f");
	}
	R_(206, 252, 8, 8, "#4dd0e1");
	R_(218, 254, 6, 6, "#26c6da");
	R_(228, 251, 7, 9, "#80deea");
	[
		["#42a5f5", 254],
		["#ff9800", 266],
		["#ec407a", 278],
	].forEach(([c, x]) => {
		R_(x, 244, 9, 3, "#8b5a2b");
		R_(x - 1, 247, 11, 15, "#dfeff2");
		R_(x, 252, 9, 9, c);
	});
	R_(314, 248, 34, 6, "#7b828d");
	R_(322, 254, 18, 5, "#5b616b");
	R_(316, 259, 30, 3, "#444a52");
	R_(314, 248, 34, 2, "#a9b0ba");
	const q = (t * 1.8) % 1;
	let a;
	if (q < 0.12) a = -1.1 + (q / 0.12) * 1.35;
	else if (q < 0.2) a = 0.25;
	else a = 0.25 - ((q - 0.2) / 0.8) * 1.35;
	const sx = cx + 14,
		sy = 240,
		ex = sx + Math.cos(a) * 34,
		ey = sy + Math.sin(a) * 34;
	ctx.lineCap = "round";
	ctx.strokeStyle = "#2a2a31";
	ctx.lineWidth = 8;
	ctx.beginPath();
	ctx.moveTo(sx, sy);
	ctx.lineTo(sx + Math.cos(a) * 16, sy + Math.sin(a) * 16);
	ctx.stroke();
	ctx.strokeStyle = "#8b5a2b";
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.moveTo(sx + Math.cos(a) * 14, sy + Math.sin(a) * 14);
	ctx.lineTo(ex, ey);
	ctx.stroke();
	ctx.lineCap = "butt";
	ctx.save();
	ctx.translate(ex, ey);
	ctx.rotate(a);
	R_(-4, -8, 9, 16, "#9aa0aa");
	R_(-4, -8, 9, 3, "#d0d5dc");
	ctx.restore();
	if (q >= 0.12 && q < 0.45) {
		const ag = (q - 0.12) / 0.33;
		ctx.save();
		ctx.globalAlpha = 1 - ag;
		const gl = ctx.createRadialGradient(329, 247, 1, 329, 247, 22);
		gl.addColorStop(0, "rgba(255,200,80,.8)");
		gl.addColorStop(1, "rgba(255,120,0,0)");
		ctx.fillStyle = gl;
		ctx.fillRect(305, 223, 48, 48);
		for (let k = 0; k < 6; k++) {
			const an = -Math.PI * (0.1 + k * 0.16);
			R_(329 + Math.cos(an) * ag * 28 * (1 + (k % 2) * 0.4), 247 + Math.sin(an) * ag * 28 + ag * ag * 16, 3, 3, "#ffb300");
		}
		ctx.restore();
	}
	R_(348, 270, 28, 24, "#6b4a2b");
	R_(348, 270, 28, 3, "#8b6238");
	R_(348, 279, 28, 2, "#4a321c");
	R_(348, 287, 28, 2, "#4a321c");
	R_(374, 262, 3, 12, "#4a321c");
	[
		[356, 298],
		[370, 298],
	].forEach(([x, y]) => {
		ctx.fillStyle = "#c62828";
		ctx.beginPath();
		ctx.arc(x, y, 5, 0, 7);
		ctx.fill();
		R_(x - 1, y - 1, 2, 2, "#222");
	});
}
function shopTap(i) {
	if (SS.sel === i) return;
	SS.sel = i;
	G.sm = "";
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

