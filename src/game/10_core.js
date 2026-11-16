// ===== 10_core.js =====
// ===== ЯДРО: ассеты, спрайты на общей пиксельной сетке, частицы, свет, таймеры, качество =====
// Вся графика нарисована на сетке 609x270 «арт-пикселей»; 1 арт-пиксель = AP логических px холста 1218x540.
const AP = 2,
	TAU = 6.2832;
const IMG = {},
	ATL = ATLAS,
	SILC = new Map(),
	GLOWC = {};
let READY = false,
	LOADP = 0,
	TSC = 1; // масштаб времени боя (слоумо)
const mkC = (w, h) => {
	const c = document.createElement("canvas");
	c.width = w;
	c.height = h;
	return c;
};
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v),
	lerp = (a, b, k) => a + (b - a) * k,
	rr = (a, b) => a + Rand.next() * (b - a),
	pick = (a) => a[(Rand.next() * a.length) | 0];
function rng32(s) {
	s |= 0;
	return () => {
		s = (s + 0x6d2b79f5) | 0;
		let q = Math.imul(s ^ (s >>> 15), 1 | s);
		q = (q + Math.imul(q ^ (q >>> 7), 61 | q)) ^ q;
		return ((q ^ (q >>> 14)) >>> 0) / 4294967296;
	};
}
const ez = {
	o: (k) => 1 - (1 - k) * (1 - k),
	o3: (k) => 1 - Math.pow(1 - k, 3),
	io: (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2),
	back: (k) => 1 + 2.70158 * Math.pow(k - 1, 3) + 1.70158 * Math.pow(k - 1, 2),
	el: (k) => (k <= 0 ? 0 : k >= 1 ? 1 : Math.pow(2, -10 * k) * Math.sin((k * 10 - 0.75) * 2.094) + 1),
};
const fmt = (n) => {
	n = Math.round(n);
	const a = Math.abs(n);
	return a >= 1e9 ? (n / 1e9).toFixed(1) + "B" : a >= 1e6 ? (n / 1e6).toFixed(1) + "M" : a >= 1e4 ? (n / 1e3).toFixed(1) + "K" : "" + n;
};
const pct = (v) => Math.round(v * 100) + "%";

// ---------- загрузка ----------
function loadAll() {
	const names = Object.keys(ASSET);
	let n = 0;
	const ps = names.map(
		(k) =>
			new Promise((res) => {
				const i = new Image();
				i.onload = () => {
					IMG[k] = i;
					LOADP = ++n / names.length;
					res();
				};
				i.onerror = () => {
					n++;
					res();
				};
				i.src = ASSET[k];
			}),
	);
	let fp = Promise.resolve();
	try {
		const ff = new FontFace("GameFont", "url(" + FONT_URI + ")", { weight: "500 800" });
		fp = ff
			.load()
			.then((f) => document.fonts.add(f))
			.catch(() => {});
	} catch (e) {}
	return Promise.all([...ps, fp]).then(() => {
		READY = true;
	});
}

// ---------- спрайты ----------
// кадр персонажа f = [sx, sy, sw, sh, ax, ay]; (x, y) — точка опоры (ступни)
function fr(img, f, x, y, fx = 1, sc = AP, sy = 1) {
	const w = f[2] * sc,
		h = f[3] * sc * sy;
	if (fx < 0) {
		ctx.save();
		ctx.translate(x, y);
		ctx.scale(-1, 1);
		ctx.drawImage(img, f[0], f[1], f[2], f[3], -f[4] * sc, -f[5] * sc * sy, w, h);
		ctx.restore();
	} else ctx.drawImage(img, f[0], f[1], f[2], f[3], x - f[4] * sc, y - f[5] * sc * sy, w, h);
}
// спрайт из атласа по имени: us — левый верх, uc — центр, ub — низ-центр
function us(a, n, x, y, sc = AP, img) {
	const r = ATL[a][n];
	ctx.drawImage(img || IMG[a], r[0], r[1], r[2], r[3], x, y, r[2] * sc, r[3] * sc);
}
function uc(a, n, cx, cy, sc = AP, img) {
	const r = ATL[a][n];
	ctx.drawImage(img || IMG[a], r[0], r[1], r[2], r[3], Math.round(cx - (r[2] * sc) / 2), Math.round(cy - (r[3] * sc) / 2), r[2] * sc, r[3] * sc);
}
function ub(a, n, cx, by, sc = AP, img) {
	const r = ATL[a][n];
	ctx.drawImage(img || IMG[a], r[0], r[1], r[2], r[3], Math.round(cx - (r[2] * sc) / 2), Math.round(by - r[3] * sc), r[2] * sc, r[3] * sc);
}
// Костёр: 8 готовых растровых кадров, единый якорь по камням, без свечения.
function drawCampfire(cx, by, sc = AP, ph = 0) {
	const A = ATL.campfireAnim, img = IMG.campfireAnim;
	if (!A || !img) { ub("props", "campfire", cx, by, sc); return; }
	const fs = A.frames, f = fs[Math.floor(t * 9 + ph) % fs.length];
	ctx.drawImage(img, f[0], f[1], f[2], f[3], Math.round(cx - f[2] * sc / 2), Math.round(by - f[3] * sc), f[2] * sc, f[3] * sc);
}
// 9-слайс из атласа ui: углы cs арт-пикселей рисуются 1:1 (x2), середина тянется
function n9(n, x, y, w, h, cs, sc = AP, c2 = ctx, hollow = false) {
	const r = ATL.ui[n],
		im = IMG.ui,
		d = Math.min(cs * sc, w / 2, h / 2),
		xs = [0, cs, r[2] - cs, r[2]],
		ys = [0, cs, r[3] - cs, r[3]],
		xd = [x, x + d, x + w - d, x + w],
		yd = [y, y + d, y + h - d, y + h];
	for (let j = 0; j < 3; j++)
		for (let i = 0; i < 3; i++) {
			const dw = xd[i + 1] - xd[i],
				dh = yd[j + 1] - yd[j];
			if (dw > 0 && dh > 0 && !(hollow && i === 1 && j === 1)) c2.drawImage(im, r[0] + xs[i], r[1] + ys[j], xs[i + 1] - xs[i], ys[j + 1] - ys[j], xd[i], yd[j], dw, dh);
		}
}
// одноцветный силуэт атласа (тень, белая вспышка попадания)
function silOf(img, col) {
	let m = SILC.get(img);
	if (!m) SILC.set(img, (m = {}));
	if (!m[col]) {
		const c = mkC(img.width, img.height),
			x = c.getContext("2d");
		x.drawImage(img, 0, 0);
		x.globalCompositeOperation = "source-in";
		x.fillStyle = col;
		x.fillRect(0, 0, c.width, c.height);
		m[col] = c;
	}
	return m[col];
}
// перекраска атласа по правилам HSV: {h:[lo,hi], to, sat, val} — диапазон тона; {gray:1, to, sat, val} — тонировка серого
function recolor(img, rules) {
	const c = mkC(img.width, img.height),
		x = c.getContext("2d");
	x.drawImage(img, 0, 0);
	const d = x.getImageData(0, 0, c.width, c.height),
		p = d.data;
	for (let i = 0; i < p.length; i += 4) {
		if (!p[i + 3]) continue;
		const r = p[i] / 255,
			g = p[i + 1] / 255,
			b = p[i + 2] / 255,
			mx = Math.max(r, g, b),
			mn = Math.min(r, g, b),
			df = mx - mn;
		let h = 0;
		if (df > 1e-5) h = mx === r ? ((g - b) / df + 6) % 6 : mx === g ? (b - r) / df + 2 : (r - g) / df + 4;
		h *= 60;
		let s = mx > 0 ? df / mx : 0,
			v = mx,
			hit = false;
		for (const q of rules) {
			if (q.gray) {
				if (s > 0.26 || v < 0.16) continue;
				h = q.to;
				s = q.sat;
				v = Math.min(1, v * (q.val || 1));
			} else {
				if (s < 0.14) continue;
				const lo = q.h[0],
					hi = q.h[1];
				if (lo <= hi ? h < lo || h > hi : h < lo && h > hi) continue;
				h = q.to;
				s = Math.min(1, s * (q.sat || 1));
				v = Math.min(1, v * (q.val || 1));
			}
			hit = true;
			break;
		}
		if (!hit) continue;
		const cc = v * s,
			hh = (h % 360) / 60,
			xx = cc * (1 - Math.abs((hh % 2) - 1)),
			m = v - cc,
			k = hh | 0;
		const R1 = k === 0 || k === 5 ? cc : k === 1 || k === 4 ? xx : 0,
			G1 = k === 1 || k === 2 ? cc : k === 0 || k === 3 ? xx : 0,
			B1 = k === 3 || k === 4 ? cc : k === 2 || k === 5 ? xx : 0;
		p[i] = (R1 + m) * 255;
		p[i + 1] = (G1 + m) * 255;
		p[i + 2] = (B1 + m) * 255;
	}
	x.putImageData(d, 0, 0);
	return c;
}
function glowSpr(col) {
	if (!GLOWC[col]) {
		const c = mkC(48, 48),
			x = c.getContext("2d"),
			g = x.createRadialGradient(24, 24, 0, 24, 24, 24);
		g.addColorStop(0, col);
		g.addColorStop(0.35, col);
		g.addColorStop(1, "rgba(0,0,0,0)");
		x.globalAlpha = 0.9;
		x.fillStyle = g;
		x.fillRect(0, 0, 48, 48);
		const g2 = x.createRadialGradient(24, 24, 0, 24, 24, 24);
		g2.addColorStop(0, "rgba(0,0,0,0)");
		g2.addColorStop(1, "rgba(0,0,0,1)");
		x.globalCompositeOperation = "destination-out";
		x.globalAlpha = 0.55;
		x.fillStyle = g2;
		x.fillRect(0, 0, 48, 48);
		GLOWC[col] = c;
	}
	return GLOWC[col];
}
// аддитивное свечение
function glow(x, y, r, col, a = 1) {
	const o = ctx.globalCompositeOperation,
		ga = ctx.globalAlpha;
	ctx.globalCompositeOperation = "lighter";
	ctx.globalAlpha = ga * a;
	ctx.drawImage(glowSpr(col), x - r, y - r, r * 2, r * 2);
	ctx.globalAlpha = ga;
	ctx.globalCompositeOperation = o;
}

// ---------- качество графики ----------
const QL = { lv: 2, auto: true, bad: 0, ft: 16 };
function guessQ() {
	const m = navigator.deviceMemory || 4,
		c = navigator.hardwareConcurrency || 4;
	return /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) ? (m <= 2 || c <= 4 ? 0 : m <= 4 ? 1 : 2) : 2;
}
function setQ(v) {
	QL.auto = v === "auto" || v === undefined || v === null;
	QL.lv = QL.auto ? guessQ() : v;
	CFG.q = QL.auto ? "auto" : v;
	applyQ();
}
function applyQ() {
	Parts.cap = [130, 300, 620][QL.lv];
	QL.bad = 0;
}
// авто-режим: если кадр стабильно дольше 26 мс — снижаем уровень (частицы, свет, тени, разрешение)
function perfTick(ms) {
	QL.ft += (ms - QL.ft) * 0.05;
	if (!QL.auto || QL.lv === 0) return;
	QL.bad = QL.ft > 26 ? QL.bad + ms : Math.max(0, QL.bad - ms * 2);
	if (QL.bad > 3000) {
		QL.lv--;
		applyQ();
		if (typeof hiDpi === "function") hiDpi();
	}
}

// ---------- частицы (общий пул с лимитом) ----------
// k: 0 пиксель, 1 свечение, 2 штрих по скорости, 3 кольцо, 4 лист/снежинка, 5 дым;  l: 0 под юнитами, 1 над юнитами, 2 экран (погода)
const Parts = {
	a: [],
	cap: 620,
	add(o) {
		if (this.a.length >= this.cap) {
			if (!o.imp) return;
			this.a.shift();
		}
		o.t = 0;
		if (o.l === undefined) o.l = 1;
		if (o.k === undefined) o.k = 0;
		if (o.vx === undefined) o.vx = 0;
		if (o.vy === undefined) o.vy = 0;
		this.a.push(o);
	},
	upd(dt) {
		const a = this.a;
		let j = 0;
		for (let i = 0; i < a.length; i++) {
			const p = a[i];
			p.t += dt;
			if (p.t >= p.life) continue;
			if (p.g) p.vy += p.g * dt;
			if (p.dr) {
				const k = Math.exp(-p.dr * dt);
				p.vx *= k;
				p.vy *= k;
			}
			p.x += p.vx * dt;
			p.y += p.vy * dt;
			if (p.wob) p.x += Math.sin(p.t * (p.wf || 3) + (p.ph || 0)) * p.wob * dt;
			if (p.fl !== undefined && p.y > p.fl && p.vy > 0) {
				if (p.bn) {
					p.y = p.fl;
					p.vy *= -p.bn;
					p.vx *= 0.6;
					p.bn *= 0.5;
				} else continue;
			}
			a[j++] = p;
		}
		a.length = j;
	},
	draw(l) {
		const a = this.a;
		let add = false;
		for (let i = 0; i < a.length; i++) {
			const p = a[i];
			if (p.l !== l) continue;
			const q = p.t / p.life,
				al = (p.a === undefined ? 1 : p.a) * (p.fade === 0 ? 1 : p.fi && q < p.fi ? q / p.fi : 1 - q * q);
			if (al <= 0.01) continue;
			const s = p.s * (p.e === undefined ? 1 : 1 + (p.e - 1) * q);
			const wantAdd = p.k === 1 || p.add === 1;
			if (wantAdd !== add) {
				ctx.globalCompositeOperation = wantAdd ? "lighter" : "source-over";
				add = wantAdd;
			}
			ctx.globalAlpha = al;
			if (p.k === 0) {
				ctx.fillStyle = p.c;
				ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), Math.max(1, Math.round(s)), Math.max(1, Math.round(s)));
			} else if (p.k === 1) ctx.drawImage(glowSpr(p.c), p.x - s, p.y - s, s * 2, s * 2);
			else if (p.k === 2) {
				ctx.strokeStyle = p.c;
				ctx.lineWidth = s;
				ctx.beginPath();
				ctx.moveTo(p.x, p.y);
				ctx.lineTo(p.x - p.vx * (p.len || 0.03), p.y - p.vy * (p.len || 0.03));
				ctx.stroke();
			} else if (p.k === 3) {
				ctx.strokeStyle = p.c;
				ctx.lineWidth = Math.max(1, (p.w || 4) * (1 - q));
				ctx.beginPath();
				ctx.ellipse(p.x, p.y, lerp(p.r0 || 4, p.r1, ez.o3(q)), lerp(p.r0 || 4, p.r1, ez.o3(q)) * (p.fy || 1), 0, 0, TAU);
				ctx.stroke();
			} else if (p.k === 4) {
				ctx.fillStyle = p.c;
				const w = Math.abs(Math.cos(p.t * (p.vr || 5) + (p.ph || 0))) * s + 1;
				ctx.fillRect(Math.round(p.x - w / 2), Math.round(p.y - s / 2), Math.round(w), Math.round(s));
			} else {
				ctx.fillStyle = p.c;
				ctx.beginPath();
				ctx.arc(p.x, p.y, s, 0, TAU);
				ctx.fill();
			}
		}
		ctx.globalAlpha = 1;
		if (add) ctx.globalCompositeOperation = "source-over";
	},
	clear(l) {
		this.a = l === undefined ? [] : this.a.filter((p) => p.l !== l);
	},
};
// разлёт частиц из точки
function burst(x, y, n, o) {
	n = Math.max(1, Math.round(n * [0.45, 0.7, 1][QL.lv]));
	for (let i = 0; i < n; i++) {
		const a = o.ang === undefined ? Rand.next() * TAU : o.ang + (Rand.next() - 0.5) * (o.spread || 1),
			v = (o.sp || 120) * (0.35 + Rand.next() * 0.8);
		Parts.add({
			x: x + (Rand.next() - 0.5) * (o.rad || 0),
			y: y + (Rand.next() - 0.5) * (o.rad || 0),
			vx: Math.cos(a) * v,
			vy: Math.sin(a) * v * (o.flat || 1) - (o.up || 0),
			g: o.g === undefined ? 420 : o.g,
			dr: o.dr || 0,
			life: (o.life || 0.5) * (0.6 + Rand.next() * 0.7),
			c: Array.isArray(o.c) ? pick(o.c) : o.c,
			s: (o.s || 4) * (o.sv ? 0.6 + Rand.next() * o.sv : 1),
			k: o.k || 0,
			l: o.l === undefined ? 1 : o.l,
			e: o.e,
			fl: o.fl,
			bn: o.bn,
			a: o.a,
			len: o.len,
			add: o.add,
		});
	}
}
function ring(x, y, r1, c, life = 0.4, w = 5, fy = 0.5, l = 0) {
	Parts.add({ x, y, k: 3, r0: 6, r1, c, life, w, fy, l, imp: 1 });
}

// ---------- свет: карта освещения 1/4 разрешения, умножается на сцену ----------
const Light = {
	c: null,
	x: null,
	init() {
		this.c = mkC(Math.ceil(W / 4), Math.ceil(H / 4));
		this.x = this.c.getContext("2d");
	},
	begin(amb) {
		const x = this.x;
		x.globalCompositeOperation = "source-over";
		x.globalAlpha = 1;
		x.fillStyle = amb;
		x.fillRect(0, 0, this.c.width, this.c.height);
		x.globalCompositeOperation = "lighter";
	},
	add(px, py, r, col, a = 1) {
		const x = this.x;
		x.globalAlpha = a;
		x.drawImage(glowSpr(col), (px - r) / 4, (py - r) / 4, r / 2, r / 2);
	},
	end() {
		ctx.save();
		ctx.globalCompositeOperation = "multiply";
		ctx.imageSmoothingEnabled = true;
		ctx.drawImage(this.c, 0, 0, W, H);
		ctx.restore();
	},
};

// ---------- отложенные действия (по игровому времени t) ----------
const Seq = {
	q: [],
	version: 0,
	// часы очереди: в бою — время симуляции (F.time), иначе — обычное время кадра.
	// Так ускорение боя не растягивает задержки выстрелов и способностей.
	clock: null,
	now() {
		return this.clock === null ? t : this.clock;
	},
	at(d, f) {
		this.q.push({ t: this.now() + d, f });
	},
	run() {
		if (!this.q.length) return;
		const nt = this.now(),
			due = this.q.filter((e) => e.t <= nt);
		if (!due.length) return;
		this.q = this.q.filter((e) => e.t > nt);
		const version = this.version;
		for (const e of due) {
			if (this.version !== version) break;
			e.f();
		}
	},
	clear() {
		this.q = [];
		this.clock = null;
		this.version++;
	},
};
// тряска — только для сильных событий; сила и общий выключатель в настройках
function shake(a) {
	if (CFG.shake === false) return;
	SK = Math.max(SK, a);
}
function sfx(n, v) {
	Music.sfx(n, v);
}

