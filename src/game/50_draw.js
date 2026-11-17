// ===== 50_draw.js =====
// ===== ОТРИСОВКА БОЯ: сцена, бойцы, эффекты, свет, полосы здоровья, цифры урона, интерфейс боя =====
let DT = 0.016;
const CAM = { z: 1, x: 609, y: 270 };
// слой 609x270 для векторных эффектов: рисуем в половинном разрешении и растягиваем без сглаживания —
// кольца, дуги ударов и лучи получаются в той же пиксельной сетке, что и спрайты
const LAY = { c: null, x: null, m: null };
function layBegin() {
	if (!LAY.c) {
		LAY.c = mkC(609, 270);
		LAY.x = LAY.c.getContext("2d");
	}
	LAY.m = ctx;
	ctx = LAY.x;
	ctx.setTransform(0.5, 0, 0, 0.5, 0, 0);
	ctx.clearRect(0, 0, W, H);
	ctx.globalAlpha = 1;
	ctx.globalCompositeOperation = "source-over";
}
function layEnd() {
	ctx.globalAlpha = 1;
	ctx.globalCompositeOperation = "source-over";
	ctx = LAY.m;
	ctx.drawImage(LAY.c, 0, 0, W, H);
}
let VIGC = null;
function vignette(a = 1) {
	if (!VIGC) {
		VIGC = mkC(305, 135);
		const x = VIGC.getContext("2d"),
			g = x.createRadialGradient(152, 67, 70, 152, 67, 185);
		g.addColorStop(0, "rgba(8,4,16,0)");
		g.addColorStop(1, "rgba(8,4,16,.6)");
		x.fillStyle = g;
		x.fillRect(0, 0, 305, 135);
	}
	ctx.save();
	ctx.imageSmoothingEnabled = true;
	ctx.globalAlpha = a;
	ctx.drawImage(VIGC, 0, 0, W, H);
	ctx.restore();
}
// стрелка-указатель вниз (в атласе она смотрит вправо)
function arrowDown(x, y) {
	ctx.save();
	ctx.translate(Math.round(x), Math.round(y));
	ctx.rotate(Math.PI / 2);
	uc("ui", "g_arrow", 0, 0, AP);
	ctx.restore();
}
// ---------- кадры ----------
function aFrame(A, n, k, loopT) {
	// Пустая или неизвестная анимация безопасно возвращается к ожиданию.
	const f = Array.isArray(A[n]) && A[n].length ? A[n] : A.idle;
	if (!Array.isArray(f) || !f.length) return undefined;
	if (loopT !== undefined) {
		const step = Number.isFinite(loopT) ? Math.floor(loopT) : 0;
		return f[((step % f.length) + f.length) % f.length];
	}
	const phase = Number.isFinite(k) ? k : 0;
	return f[Math.min(f.length - 1, Math.max(0, Math.floor(phase * f.length)))];
}
function uSet(u, wi) {
	if (u.team) return [ATL.mobs[u.boss ? (u.bph ? "king2" : "king") : u.set], mobImg(WORLDS[wi], u.img)];
	if (IMG.heroes3 && ATL.heroes3 && ATL.heroes3[u.k]) return [ATL.heroes3[u.k], IMG.heroes3];
	if (IMG["gen_" + u.k] && ATL.heroes2 && ATL.heroes2[u.k]) return [ATL.heroes2[u.k], IMG["gen_" + u.k]];
	if (IMG.heroes2 && ATL.heroes2 && ATL.heroes2[u.k]) return [ATL.heroes2[u.k], IMG.heroes2];
	return [ATL.heroes[u.k], IMG.heroes];
}
function uFrame(u, A) {
	if (u.an) return aFrame(A, u.an.n, u.an.t / u.an.d, u.an.n === "win" ? t * 3.2 + u.ph : undefined);
	if (u.jump) return aFrame(A, "jump", 0, t * 6 + u.ph);
	if (u.dodgeT > 0) return aFrame(A, "dodge", 0, t * 8 + u.ph);
	if (u.atkT > 0) return aFrame(A, "atk", 1 - u.atkT / u.atkD);
	if (u.mv) return u.set && !u.boss ? aFrame(A, "walk", u.hop / 0.62 > 1 ? 0 : u.hop / 0.62) : aFrame(A, u.spd >= 7 && A.run ? "run" : "walk", 0, (F ? F.time : t) * (u.k === "frost" && !u.team ? 3.2 + u.spd * 0.35 : 5 + u.spd * 0.7) + u.ph);
	return aFrame(A, "idle", 0, t * 2.3 + u.ph);
}
const uTop = (u) => (u.boss ? 178 * (u.sc || 1) : u.team ? 60 * (u.sc || 1) : 84);
// портрет героя (обрезается рамкой слота)
function uPort(u, cx, by, sc = AP, dim = false) {
	if (u.team) {
		const [A, img] = uSet(u, G ? G.w || 0 : 0),
			f = A.idle[0];
		fr(img, f, cx, by, -1, sc * (u.boss ? 0.34 : 1));
		return;
	}
	const is3 = IMG.heroes3 && ATL.heroes3 && ATL.heroes3[u.k];
	const is2 = !is3 && (IMG["gen_" + u.k] || IMG.heroes2) && ATL.heroes2 && ATL.heroes2[u.k];
	const f = is3 ? ATL.heroes3[u.k].port[0] : is2 ? ATL.heroes2[u.k].port[0] : ATL.heroes[u.k].port[0];
	const img = is3 ? IMG.heroes3 : is2 ? (IMG["gen_" + u.k] || IMG.heroes2) : IMG.heroes;
	const sc2 = (is3 || is2) ? (sc * 34) / f[2] : sc;
	if (dim) frSil(img, f, "#2a2436", cx, by, 1, sc2);
	else fr(img, f, cx, by, 1, sc2);
}
// фигура бойца «в полный рост» для экранов вне боя
function uIdle(u, x, y, sc = AP, face = 1, wi = 0, an = "idle") {
	const [A, img] = uSet(u, wi),
		f = an === "idle" ? aFrame(A, "idle", 0, t * 2.3 + (u.ph || 0)) : aFrame(A, an, 0, t * (an === "walk" ? 8 : 3.2) + (u.ph || 0));
	fr(img, f, x, y, face, sc * (u.sc || 1), 1 + 0.02 * Math.sin(t * 3 + (u.ph || 0)));
}
// Короткое смешивание настоящих соседних кадров без добавления фальшивых кадров в атлас.
const SPRITE_TRANSITIONS = new WeakMap();
function spriteTransition(u, img, frame, now) {
	let q = SPRITE_TRANSITIONS.get(u);
	if (!q || q.img !== img || now < q.last || now - q.last > 0.3) {
		q = { img, frame, prev: null, start: now, last: now };
		SPRITE_TRANSITIONS.set(u, q);
		return [null, 1];
	}
	if (q.frame !== frame) {
		q.prev = q.frame;
		q.frame = frame;
		q.start = now;
	}
	q.last = now;
	const mix = Math.min(1, Math.max(0, (now - q.start) / 0.065));
	if (!q.prev || mix >= 1) { q.prev = null; return [null, 1]; }
	return [q.prev, 0.25 + 0.75 * mix];
}
function dUnit(u, wi, o = {}) {
	const bk = u.born !== undefined ? (t - u.born) / 0.32 : 1;
	if (bk <= 0) return;
	const [A, img] = uSet(u, wi),
		f = uFrame(u, A);
	let x = u.x,
		y = u.y - (u.z || 0),
		sc = AP * (u.sc || 1),
		sy = 1;
	if (bk < 1) {
		sc *= ez.back(bk);
		sy = 0.6 + 0.4 * bk;
	}
	if (u.atkT > 0 && u.rng < 140) {
		const q = Math.sin(Math.PI * (1 - u.atkT / u.atkD));
		x += u.ax * q * 12;
		y += u.ay * q * 6;
	}
	if (u.team && u.set) sy *= u.z > 1 ? 1.1 : u.mv && !u.boss ? 0.86 : 1 + 0.035 * Math.sin(t * 3.4 + u.ph);
	else if (!u.mv) sy *= 1 + 0.018 * Math.sin(t * 3 + u.ph);
	if (u.hitT > 0) x += Math.sin(u.hitT * 95) * 3;
	if (u.st && u.st.stun && !u.st.stun.ice) x += Math.sin(t * 40) * 1;
	x = Math.round(x);
	y = Math.round(y);
	const fx = u.face;
	if (o.sel) {
		for (const [ox, oy] of [
			[-2, 0],
			[2, 0],
			[0, -2],
			[0, 2],
		])
			frSil(img, f, "#ffe27a", x + ox, y + oy, fx, sc, sy);
	} else if (u.inv > 0) {
		ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 16);
		for (const [ox, oy] of [
			[-2, 0],
			[2, 0],
			[0, -2],
			[0, 2],
		])
			frSil(img, f, "#fff3b0", x + ox, y + oy, fx, sc, sy);
		ctx.globalAlpha = 1;
	}
	const baseAlpha = o.a === undefined ? 1 : o.a;
	const [previous, mix] = !u.team && img === IMG.heroes3 ? spriteTransition(u, img, f, t) : [null, 1];
	if (previous) {
		ctx.globalAlpha = baseAlpha;
		fr(img, previous, x, y, fx, sc, sy);
	}
	ctx.globalAlpha = baseAlpha * mix;
	fr(img, f, x, y, fx, sc, sy);
	ctx.globalAlpha = baseAlpha;
	const s = u.st || {},
		tint = (c, a) => {
			ctx.globalAlpha = a * (o.a === undefined ? 1 : o.a);
			frSil(img, f, c, x, y, fx, sc, sy);
		};
	if (s.stun && s.stun.ice) tint("#bff0ff", 0.62);
	else if (s.chill) tint("#6fd0ff", 0.36);
	if (s.poison) tint("#7be04e", 0.22 + 0.08 * Math.sin(t * 6));
	if (s.burn) tint("#ff7a2c", 0.22 + 0.12 * Math.sin(t * 14));
	if (s.curse) tint("#8a4fd8", 0.3);
	if (s.rage) tint("#ff3a2a", 0.2 + 0.14 * Math.sin(t * 9));
	if (u.hitT > 0) tint("#ffffff", Math.min(0.92, u.hitT / 0.12));
	ctx.globalAlpha = 1;
}
// ---------- полосы здоровья и статусы ----------
function uBar(u, fight) {
	if (u.born !== undefined && t < u.born + 0.2) return;
	const boss = u.boss,
		w = boss ? 0 : u.team ? 40 : 44,
		x = Math.round(u.x - w / 2),
		y = Math.round(u.y - uTop(u) - (u.z || 0) - 8);
	if (!boss) {
		const k = u.hp / u.max;
		pbar(x, y, w, 5, k, u.team ? (u.slot === "b" ? "#ff8a3c" : "#ff5a5a") : k > 0.5 ? "#5fe06a" : k > 0.25 ? "#ffd23c" : "#ff5a4a", { lag: u.hpl, lc: u.team ? "#fff" : "#ff9a8a", sh: u.sh > 0 ? u.sh / u.max : 0 });
		if (!u.team) {
			if (u.r > 0) uc("ui", "gem" + Math.min(u.r, 5), x - 9, y + 2, 1);
			if (fight && KIT[u.k]) {
				const e = u.en / 100,
					full = e >= 1;
				ctx.fillStyle = INK;
				ctx.fillRect(x - 2, y + 7, w + 4, 5);
				ctx.fillStyle = full ? (Math.sin(t * 12) > 0 ? "#fff3a0" : "#ffb828") : "#58b8ff";
				ctx.fillRect(x, y + 7, Math.round(w * e), 3);
			}
		}
	}
	// значки статусов
	const s = u.st || {},
		ks = [];
	for (const k in s) if (ATL.ui["s_" + k]) ks.push(k);
	if (u.sh > 0) ks.push("shield");
	if (ks.length) {
		const yy = boss ? u.y - uTop(u) - (u.z || 0) - 4 : y - 11,
			x0 = u.x - (ks.length * 16 - 2) / 2;
		ks.forEach((k, i) => us("ui", "s_" + k, Math.round(x0 + i * 16), Math.round(yy - 7), AP));
	}
	if (s.stun && !u.dead) {
		// звёздочки оглушения
		const cy = u.y - uTop(u) - (u.z || 0) + (boss ? 30 : 6);
		for (let i = 0; i < 3; i++) {
			const a = t * 5 + (i * TAU) / 3,
				sx = u.x + Math.cos(a) * (boss ? 44 : 16),
				sy = cy + Math.sin(a) * 5;
			ctx.fillStyle = s.stun.ice ? "#dff8ff" : "#ffe27a";
			ctx.fillRect(Math.round(sx / 2) * 2 - 2, Math.round(sy / 2) * 2 - 2, 4, 4);
		}
	}
}
function dNums() {
	for (const n of F.nums) {
		const life = n.k === "crit" || n.k === "txt" ? 1.1 : 0.85,
			k = n.t / life,
			pop = n.t < 0.12 ? ez.back(n.t / 0.12) : 1;
		let sz = n.sz || 20,
			col = n.c || "#fff";
		if (n.k === "crit") (sz = 30), (col = "#ffd23c");
		else if (n.k === "hit") (sz = 19), (col = "#ffffff");
		else if (n.k === "dmg") (sz = 19), (col = "#ff7a66");
		else if (n.k === "heal") (sz = 19), (col = "#6dff7a");
		else if (n.k === "dot") sz = 15;
		else if (n.k === "sh") (sz = 15), (col = "#8fd6ff");
		ctx.globalAlpha = k > 0.7 ? Math.max(0, (1 - k) / 0.3) : 1;
		txo(n.s, Math.round(n.x + n.vx * n.t), Math.round(n.y - (n.k === "crit" ? 30 : 44) * ez.o(Math.min(1, k))), Math.max(8, Math.round(sz * pop * (n.k === "crit" ? 1 + 0.3 * Math.max(0, 1 - n.t * 5) : 1))), col, "center", n.k === "crit" ? "#7a1a08" : INK);
	}
	ctx.globalAlpha = 1;
}
// ---------- эффекты ----------
function jag(x0, y0, x1, y1, amp, seed) {
	const R = rng32(seed),
		n = Math.max(3, (Math.hypot(x1 - x0, y1 - y0) / 26) | 0);
	ctx.beginPath();
	ctx.moveTo(x0, y0);
	for (let i = 1; i < n; i++) {
		const k = i / n;
		ctx.lineTo(x0 + (x1 - x0) * k + (R() - 0.5) * amp, y0 + (y1 - y0) * k + (R() - 0.5) * amp);
	}
	ctx.lineTo(x1, y1);
	ctx.stroke();
}
function dTele(A) {
	for (const q of F.tele) {
		const k = Math.min(1, q.t / q.d),
			pu = 0.55 + 0.45 * Math.sin(t * 22 * (0.5 + k));
		ctx.fillStyle = ctx.strokeStyle = q.c;
		if (q.shape === "line") {
			const wd = q.wd || 14;
			ctx.save();
			ctx.translate(q.x, q.y);
			ctx.scale(1, 0.62);
			ctx.rotate(Math.atan2(Math.sin(q.a) / 0.62, Math.cos(q.a)));
			ctx.globalAlpha = 0.16 + 0.1 * pu;
			ctx.fillRect(0, -wd, q.len, wd * 2);
			ctx.globalAlpha = 0.5;
			ctx.fillRect(0, -wd, q.len * k, wd * 2);
			ctx.globalAlpha = 0.9;
			ctx.fillRect(0, -wd - 2, q.len, 2);
			ctx.fillRect(0, wd, q.len, 2);
			ctx.restore();
		} else if (q.shape === "band") {
			const y = q.y - q.h / 2;
			ctx.globalAlpha = 0.14 + 0.1 * pu;
			ctx.fillRect(FLD.x0 - 40, y, FLD.x1 - FLD.x0 + 80, q.h);
			ctx.globalAlpha = 0.45;
			const w = (FLD.x1 - FLD.x0 + 80) * k;
			ctx.fillRect(FLD.x1 + 40 - w, y, w, q.h);
			ctx.globalAlpha = 0.9;
			ctx.fillRect(FLD.x0 - 40, y - 2, FLD.x1 - FLD.x0 + 80, 2);
			ctx.fillRect(FLD.x0 - 40, y + q.h, FLD.x1 - FLD.x0 + 80, 2);
			for (let i = 0; i < 9; i++) {
				// стрелки направления удара
				const ax = FLD.x1 - ((t * 240 + i * 130) % (FLD.x1 - FLD.x0));
				ctx.beginPath();
				ctx.moveTo(ax, q.y - 10);
				ctx.lineTo(ax - 14, q.y);
				ctx.lineTo(ax, q.y + 10);
				ctx.lineWidth = 4;
				ctx.stroke();
			}
		} else {
			const rx = q.r,
				ry = q.r / 1.6;
			ctx.globalAlpha = 0.16 + 0.1 * pu;
			ctx.beginPath();
			ctx.ellipse(q.x, q.y, rx, ry, 0, 0, TAU);
			ctx.fill();
			ctx.globalAlpha = 0.5;
			ctx.beginPath();
			ctx.ellipse(q.x, q.y, rx * k, ry * k, 0, 0, TAU);
			ctx.fill();
			ctx.globalAlpha = 0.95;
			ctx.lineWidth = 4;
			ctx.setLineDash([14, 8]);
			ctx.lineDashOffset = -t * 60;
			ctx.beginPath();
			ctx.ellipse(q.x, q.y, rx, ry, 0, 0, TAU);
			ctx.stroke();
			ctx.setLineDash([]);
		}
		ctx.globalAlpha = 1;
	}
}
function dPools(A) {
	for (const p of A.pools) {
		const c = EL[p.el],
			a = Math.min(1, p.t * 3, (p.life - p.t) * 2),
			rx = p.r * (0.96 + 0.04 * Math.sin(t * 3 + p.x)),
			ry = rx / 1.6;
		ctx.globalAlpha = 0.5 * a;
		ctx.fillStyle = c.c;
		ctx.beginPath();
		ctx.ellipse(p.x, p.y, rx, ry, 0, 0, TAU);
		ctx.fill();
		ctx.globalAlpha = 0.75 * a;
		ctx.fillStyle = c.c2;
		ctx.beginPath();
		ctx.ellipse(p.x - 6, p.y - 2, rx * 0.55, ry * 0.5, 0, 0, TAU);
		ctx.fill();
		ctx.globalAlpha = a;
		ctx.strokeStyle = c.c;
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.ellipse(p.x, p.y, rx, ry, 0, 0, TAU);
		ctx.stroke();
		for (let i = 0; i < 4; i++) {
			const q = (t * 0.9 + i * 0.27 + p.x * 0.01) % 1;
			ctx.globalAlpha = (1 - q) * a;
			ctx.fillStyle = "#fff";
			ctx.fillRect(p.x + Math.sin(i * 7.1 + p.y) * rx * 0.6, p.y + Math.cos(i * 3.3) * ry * 0.5 - q * 16, 4, 4);
		}
		ctx.globalAlpha = 1;
	}
}
function dProj() {
	for (const p of F.proj) {
		const c = EL[p.el] || EL.phys,
			s = p.o.big ? 12 : 8,
			a = Math.atan2(p.vy, p.vx);
		ctx.save();
		ctx.translate(p.x, p.y);
		ctx.rotate(a);
		ctx.fillStyle = c.c;
		if (p.el === "ice" || p.el === "prism") {
			ctx.beginPath();
			ctx.moveTo(s + 6, 0);
			ctx.lineTo(-s, -s * 0.6);
			ctx.lineTo(-s * 0.4, 0);
			ctx.lineTo(-s, s * 0.6);
			ctx.fill();
		} else if (p.el === "bolt") {
			ctx.strokeStyle = c.c;
			ctx.lineWidth = 4;
			jag(-s * 2, 0, s, 0, 12, (t * 30) | 0);
		} else {
			ctx.beginPath();
			ctx.ellipse(0, 0, s + 3, s * 0.72, 0, 0, TAU);
			ctx.fill();
			ctx.beginPath();
			ctx.moveTo(-s * 0.4, -s * 0.7);
			ctx.lineTo(-s * 2.6, 0);
			ctx.lineTo(-s * 0.4, s * 0.7);
			ctx.fill();
		}
		ctx.fillStyle = c.c2;
		ctx.fillRect(-s * 0.35, -s * 0.35, s * 0.9, s * 0.7);
		ctx.restore();
	}
}
// отрисовка сценических эффектов по виду (f.k); k — доля прожитого времени 0…1.
// Каждый рисовальщик сам выставляет globalAlpha, dFx сбрасывает её после (тела перенесены из прежней цепочки if/else без изменений).
const FXDRAW = {
	slash(f, k) {
		ctx.save();
		ctx.translate(f.x, f.y);
		ctx.scale(f.f, 1);
		ctx.rotate(f.rot || 0);
		ctx.lineCap = "round";
		const a1 = -1.25 + 2.5 * ez.o3(k),
			a0 = a1 - 1.9 * (1 - k * 0.5);
		ctx.globalAlpha = 1 - k * k;
		ctx.strokeStyle = f.c;
		ctx.lineWidth = f.w * (1 - k * 0.5);
		ctx.beginPath();
		ctx.arc(-f.r * 0.35, 0, f.r, Math.max(-1.25, a0), a1);
		ctx.stroke();
		ctx.strokeStyle = "#ffffff";
		ctx.lineWidth = Math.max(2, f.w * 0.35 * (1 - k));
		ctx.beginPath();
		ctx.arc(-f.r * 0.35, 0, f.r, Math.max(-1.25, a1 - 0.7), a1);
		ctx.stroke();
		ctx.restore();
	},
	beam(f, k) {
		ctx.globalAlpha = 1 - k;
		ctx.strokeStyle = f.c;
		ctx.lineWidth = (f.w || 4) * (1 + k);
		ctx.beginPath();
		ctx.moveTo(f.x0, f.y0);
		ctx.lineTo(f.x1, f.y1);
		ctx.stroke();
		ctx.strokeStyle = "#fff";
		ctx.lineWidth = Math.max(2, (f.w || 4) * 0.4);
		ctx.stroke();
	},
	bolt(f, k) {
		ctx.globalAlpha = 1 - k * k;
		ctx.strokeStyle = f.c;
		ctx.lineWidth = (f.w || 3) + 3;
		const sd = ((f.x0 * 13 + f.y1 * 7) | 0) + ((f.t * 24) | 0);
		jag(f.x0, f.y0, f.x1, f.y1, 34, sd);
		ctx.strokeStyle = "#fff";
		ctx.lineWidth = Math.max(2, (f.w || 3) - 1);
		jag(f.x0, f.y0, f.x1, f.y1, 34, sd);
	},
	pillar(f, k) {
		const w = f.w * (k < 0.2 ? k / 0.2 : 1 - (k - 0.2) * 0.9);
		ctx.globalAlpha = 0.75 * (1 - k);
		ctx.fillStyle = f.c;
		ctx.fillRect(f.x - w / 2, -20, w, f.y + 20);
		ctx.globalAlpha = 0.95 * (1 - k);
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(f.x - w / 5, -20, w / 2.5, f.y + 20);
		ctx.globalAlpha = 0.8 * (1 - k);
		ctx.fillStyle = f.c;
		ctx.beginPath();
		ctx.ellipse(f.x, f.y, f.w * (0.6 + k), f.w * (0.6 + k) * 0.36, 0, 0, TAU);
		ctx.fill();
	},
	bubble(f, k) {
		const u = f.u;
		if (u.hp > 0) {
			const r = u.boss ? 104 : 34,
				cy = u.y - (u.boss ? 80 : 30) - (u.z || 0);
			ctx.globalAlpha = (1 - k) * 0.9;
			ctx.strokeStyle = f.c;
			ctx.lineWidth = 4;
			ctx.beginPath();
			ctx.ellipse(u.x, cy, r * (0.8 + 0.25 * ez.o(Math.min(1, k * 4))), r * 1.15 * (0.8 + 0.25 * ez.o(Math.min(1, k * 4))), 0, 0, TAU);
			ctx.stroke();
			ctx.globalAlpha = (1 - k) * 0.18;
			ctx.fillStyle = f.c;
			ctx.fill();
		}
	},
	ghost(f, k, wi) {
		const [A, img] = uSet(f.u, wi);
		ctx.globalAlpha = 0.6 * (1 - k);
		frSil(img, A.idle[0], "#c9a0ff", f.x, f.y, f.f, AP);
	},
	vines(f, k) {
		const u = f.u,
			g = Math.min(1, k * 5),
			a = k > 0.85 ? (1 - k) / 0.15 : 1;
		ctx.globalAlpha = a;
		ctx.lineWidth = 5;
		for (let i = 0; i < 4; i++) {
			const bx = u.x + (i - 1.5) * 13;
			ctx.strokeStyle = i & 1 ? "#3a7a2a" : "#5aa03c";
			ctx.beginPath();
			ctx.moveTo(bx, u.y + 2);
			for (let j = 1; j <= 5; j++) ctx.lineTo(bx + Math.sin(j * 1.9 + i) * 9, u.y + 2 - j * 11 * g);
			ctx.stroke();
			ctx.fillStyle = "#b8ff8a";
			ctx.fillRect(bx + Math.sin(5 * 1.9 + i) * 9 - 3, u.y - 55 * g - 2, 6, 6);
		}
	},
	wave(f, k) {
		ctx.strokeStyle = f.c;
		for (let i = 0; i < 3; i++) {
			const q = clamp(k * 1.4 - i * 0.2, 0, 1);
			if (q <= 0 || q >= 1) continue;
			ctx.globalAlpha = 1 - q;
			ctx.lineWidth = 8 * (1 - q) + 2;
			ctx.beginPath();
			ctx.ellipse(f.x, f.y, 520 * ez.o(q), 200 * ez.o(q), 0, 0, TAU);
			ctx.stroke();
		}
	},
	star(f, k) {
		const r = 46 * (0.4 + ez.o(k));
		ctx.globalAlpha = 1 - k;
		ctx.fillStyle = f.c;
		ctx.beginPath();
		for (let i = 0; i < 8; i++) {
			const a = (i / 8) * TAU + 0.4,
				rr2 = i & 1 ? r * 0.22 : r;
			ctx.lineTo(f.x + Math.cos(a) * rr2, f.y + Math.sin(a) * rr2);
		}
		ctx.fill();
	},
	sweep(f, k) {
		const x = f.x0 - (f.x0 - FLD.x0 + 80) * ez.o(k);
		ctx.globalAlpha = 0.85 * (1 - k * k);
		ctx.fillStyle = f.c;
		ctx.fillRect(x, f.y - f.h / 2, 90 + 80 * k, f.h);
		ctx.fillStyle = "#fff";
		ctx.fillRect(x, f.y - f.h / 2, 16, f.h);
		ctx.globalAlpha = 0.35 * (1 - k);
		ctx.fillStyle = f.c;
		ctx.fillRect(x, f.y - f.h / 2, f.x0 - x, f.h);
	},
};
function dFx(wi) {
	for (const f of F.fx) {
		const d = FXDRAW[f.k];
		if (d) d(f, Math.min(1, f.t / f.d), wi);
		ctx.globalAlpha = 1;
	}
}
// экранные эффекты: баннер босса, врезка ульты, вспышка, «В бой!»
function dFxScreen() {
	for (const f of F.fx) {
		const k = Math.min(1, f.t / f.d);
		if (f.k === "flash") {
			ctx.globalAlpha = 0.55 * (1 - k);
			ctx.fillStyle = f.c;
			ctx.fillRect(0, 0, W, H);
		} else if (f.k === "banner") {
			const inn = ez.o3(Math.min(1, f.t / 0.3)),
				out = f.t > f.d - 0.3 ? (f.d - f.t) / 0.3 : 1,
				y = 196;
			ctx.globalAlpha = Math.min(inn, out) * 0.6;
			ctx.fillStyle = "#07050c";
			ctx.fillRect(0, y - 58 * inn, W, 116 * inn);
			ctx.globalAlpha = Math.min(inn, out);
			ctx.fillStyle = f.c;
			ctx.fillRect(0, y - 58 * inn, W, 4);
			ctx.fillRect(0, y + 58 * inn - 4, W, 4);
			const dx = (1 - inn) * 300 + (1 - out) * -200;
			txo(f.s2, 609 - dx, y - 26, 20, f.c, "center");
			txo(f.s, 609 + dx, y + 10, 44, "#fff", "center", "#1a0a10");
		} else if (f.k === "go") {
			const s = k < 0.25 ? ez.back(k / 0.25) : 1 + (k - 0.25) * 0.5;
			ctx.globalAlpha = k > 0.6 ? (1 - k) / 0.4 : 1;
			txo("В БОЙ!", 609, 210, Math.round(60 * s), "#ffe27a", "center", "#5a1a08");
		} else if (f.k === "cut") {
			const u = f.u,
				a = k < 0.15 ? k / 0.15 : k > 0.75 ? (1 - k) / 0.25 : 1,
				c = EL[KIT[u.k].el].c;
			if (f.ult) {
				const sl = ez.o3(Math.min(1, f.t / 0.22)),
					y = 100;
				ctx.globalAlpha = a * 0.8;
				ctx.fillStyle = "#0a0612";
				ctx.beginPath();
				ctx.moveTo(-40, y);
				ctx.lineTo(560 * sl, y);
				ctx.lineTo(520 * sl, y + 78);
				ctx.lineTo(-40, y + 78);
				ctx.fill();
				ctx.globalAlpha = a;
				ctx.fillStyle = c;
				ctx.fillRect(0, y, 560 * sl, 4);
				ctx.fillRect(0, y + 74, 524 * sl, 4);
				ctx.save();
				ctx.beginPath();
				ctx.rect(0, y + 4, 600, 70);
				ctx.clip();
				{ const [A2, im2] = uSet(u, 0); const f2 = A2.port[0]; fr(im2, f2, -120 + 190 * sl, y + 128, 1, (4 * 34) / f2[2]); }
				ctx.restore();
				txo(f.s, 150 + 30 * sl, y + 30, 28, "#fff", "left", "#2a1206");
				txo(u.n + " · ульта", 152 + 30 * sl, y + 58, 15, c, "left");
			} else {
				ctx.globalAlpha = a;
				txo(f.s, u.x, u.y - uTop(u) - 34 - 12 * ez.o(k), 16, c, "center");
			}
		}
		ctx.globalAlpha = 1;
	}
}
function deadDraw(d, wi) {
	const u = d.u,
		k = d.t / d.d,
		[A, img] = uSet(u, wi),
		fs = A.dead || A.hurt,
		f = fs[Math.min(fs.length - 1, Math.floor(k * 2.2 * fs.length))];
	ctx.globalAlpha = k > 0.6 ? Math.max(0, (1 - k) / 0.4) : 1;
	if (u.boss) {
		const x = u.x + Math.sin(t * 60) * 5 * (1 - k);
		fr(img, f, x, u.y, u.face, AP * (u.sc || 1), 1 - k * 0.25);
		ctx.globalAlpha *= Math.abs(Math.sin(t * 20)) * 0.8;
		frSil(img, f, "#ffffff", x, u.y, u.face, AP * (u.sc || 1), 1 - k * 0.25);
	} else fr(img, f, u.x, u.y, u.face, AP * (u.sc || 1), u.team ? 1 - k * 0.3 : 1);
	ctx.globalAlpha = 1;
}
// ---------- сцена боя ----------
const ZONE = { x0: 96, x1: 506 };
// ---------- экстраполяция позиций между шагами симуляции ----------
// Loop.alpha — доля шага 1/60, не вошедшая в симуляцию в этом кадре (0 на ровных 60 Гц).
// Бойцы и снаряды на время отрисовки сдвигаются на alpha последнего смещения, затем
// позиции возвращаются: логика видит только «настоящие» координаты.
const LERP_PREV = new WeakMap(),
	LERP_UNDO = [];
function lerpRemember(list) {
	for (let i = 0; i < list.length; i++) {
		const u = list[i];
		let r = LERP_PREV.get(u);
		if (!r) LERP_PREV.set(u, (r = { x: 0, y: 0 }));
		r.x = u.x;
		r.y = u.y;
	}
}
function lerpApply(list, k) {
	for (let i = 0; i < list.length; i++) {
		const u = list[i],
			r = LERP_PREV.get(u);
		if (!r) continue;
		const dx = u.x - r.x,
			dy = u.y - r.y;
		// телепорт/рывок (больше 40 px за шаг) не экстраполируем — иначе на кадр промелькнёт «перелёт»
		if (dx * dx + dy * dy > 1600 || (dx === 0 && dy === 0)) continue;
		LERP_UNDO.push(u, u.x, u.y);
		u.x += dx * k;
		u.y += dy * k;
	}
}
function fightLerpIn() {
	LERP_UNDO.length = 0;
	if (!F || S !== "fight" || paused || !(Loop.alpha > 0.01) || F.lock > 0 || F.out) return;
	lerpApply(F.pl, Loop.alpha);
	lerpApply(F.en, Loop.alpha);
	if (F.proj) lerpApply(F.proj, Loop.alpha);
}
function fightLerpOut() {
	for (let i = LERP_UNDO.length - 3; i >= 0; i -= 3) {
		const u = LERP_UNDO[i];
		u.x = LERP_UNDO[i + 1];
		u.y = LERP_UNDO[i + 2];
	}
	LERP_UNDO.length = 0;
}
// камера боя: лёгкий наезд на финальный удар и смену фазы (ctx.save() здесь — парный restore в dFight)
function fightCamera(fight) {
	const tz = fight && F.slowT > 0 && F.slowS < 0.32 ? 1.12 : 1,
		fo = F.focus || { x: 609, y: 300 };
	CAM.z += (tz - CAM.z) * Math.min(1, DT * 7);
	if (Math.abs(CAM.z - 1) < 0.004) CAM.z = 1;
	ctx.save();
	if (CAM.z !== 1) {
		const cx = clamp(fo.x, W / 2 / CAM.z, W - W / 2 / CAM.z),
			cy = clamp(fo.y, H / 2 / CAM.z, H - H / 2 / CAM.z);
		ctx.translate(609, 270);
		ctx.scale(CAM.z, CAM.z);
		ctx.translate(-cx, -cy);
	}
}
// слой земли: зона расстановки, лужи, телеграфы, тени и кольца под бойцами, частицы слоя 0
function fightGround(A, w, fight, units) {
	layBegin();
	if (!fight) {
		// зона расстановки
		const y0 = A.y0 + 2,
			h = FLD.y1 - y0 + 6;
		ctx.fillStyle = "rgba(255,240,170," + (0.07 + 0.03 * Math.sin(t * 3)) + ")";
		ctx.fillRect(ZONE.x0, y0, ZONE.x1 - ZONE.x0, h);
		ctx.strokeStyle = "rgba(255,236,160,.85)";
		ctx.lineWidth = 4;
		ctx.setLineDash([16, 10]);
		ctx.lineDashOffset = -t * 26;
		ctx.strokeRect(ZONE.x0, y0, ZONE.x1 - ZONE.x0, h);
		ctx.setLineDash([]);
	}
	dPools(A);
	if (fight) dTele(A);
	for (const u of units) {
		if (u.born !== undefined && t < u.born) continue;
		const r = u.rad * (1 - Math.min(0.6, (u.z || 0) / 260));
		ctx.fillStyle = "rgba(12,8,22,.4)";
		ctx.beginPath();
		ctx.ellipse(u.x, u.y + 1, r * 1.05, r * 0.4, 0, 0, TAU);
		ctx.fill();
		if (!u.team && u.r >= 2) {
			ctx.strokeStyle = RAR[u.r].c;
			ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 4 + u.ph);
			ctx.lineWidth = 3;
			ctx.beginPath();
			ctx.ellipse(u.x, u.y + 1, r * 1.5, r * 0.6, 0, 0, TAU);
			ctx.stroke();
			ctx.globalAlpha = 1;
		}
		if (u.boss) {
			ctx.strokeStyle = w.ui;
			ctx.globalAlpha = 0.35 + 0.2 * Math.sin(t * 3);
			ctx.lineWidth = 4;
			ctx.beginPath();
			ctx.ellipse(u.x, u.y + 1, r * 1.5, r * 0.6, 0, 0, TAU);
			ctx.stroke();
			ctx.globalAlpha = 1;
		}
	}
	Parts.draw(0);
	layEnd();
}
// объекты, декор, бойцы и трупы — в порядке глубины (y)
function fightDepth(A, w, wi, units, selU) {
	const list = [];
	for (const o of A.obs)
		if (!o.dead) {
			const r = ATL.props[o.spr];
			o.occ = units.some((u) => u.y < o.y && u.y > o.y + o.oy - r[3] * 2 + 10 && Math.abs(u.x - o.x) < r[2] * 0.8 + u.rad * 0.5);
			list.push({ y: o.y, o });
		}
	for (const d of A.dec) list.push({ y: d.y - 2, d });
	for (const u of units) list.push({ y: u.y, u });
	for (const d of F.dd) list.push({ y: d.u.y - 1, dd: d });
	list.sort((a, b) => a.y - b.y);
	const pimg = propImg(w);
	for (const q of list) {
		if (q.o) drawProp(A, q.o);
		else if (q.d) {
			const r = ATL.props[q.d.spr];
			if (q.d.fl) {
				ctx.save();
				ctx.translate(Math.round(q.d.x), 0);
				ctx.scale(-1, 1);
				ctx.drawImage(pimg, r[0], r[1], r[2], r[3], -r[2], Math.round(q.d.y) - r[3] * 2 + 4, r[2] * 2, r[3] * 2);
				ctx.restore();
			} else ctx.drawImage(pimg, r[0], r[1], r[2], r[3], Math.round(q.d.x) - r[2], Math.round(q.d.y) - r[3] * 2 + 4, r[2] * 2, r[3] * 2);
		} else if (q.u) dUnit(q.u, wi, { sel: q.u === selU });
		else deadDraw(q.dd, wi);
	}
	if (F.cat) drawCat();
}
// верхний слой: снаряды, эффекты, падающие бомбы, частицы слоя 1
function fightTop(fight, wi) {
	layBegin();
	if (fight) dProj();
	dFx(wi);
	// падающие вулканические бомбы
	if (fight)
		for (const q of F.tele)
			if (q.drop) {
				const k = q.t / q.d,
					by = q.y - (1 - k) * (1 - k) * 620;
				ctx.fillStyle = "#3a2a2a";
				ctx.fillRect(q.x - 10, by - 20, 20, 20);
				ctx.fillStyle = "#ff8a3c";
				ctx.fillRect(q.x - 6, by - 16, 12, 12);
				ctx.fillStyle = "#ffe27a";
				ctx.fillRect(q.x - 2, by - 12, 6, 6);
			}
	layEnd();
	Parts.draw(1);
}
// свет, свечения, погодный тон, виньетка
function fightLight(A, w, fight, units) {
	if (QL.lv > 0) {
		Light.begin(w.amb[A.tod]);
		arenaLights(A);
		if (fight) {
			for (const p of F.proj) Light.add(p.x, p.y, p.o.big ? 110 : 80, (EL[p.el] || EL.phys).c, 0.8);
			for (const f of F.fx) {
				if (f.k === "pillar") Light.add(f.x, f.y - 60, 300 * (1 - f.t / f.d), f.c, 1);
				else if (f.k === "bolt") Light.add(f.x1, f.y1, 180, f.c, 0.9);
			}
		}
		for (const u of units) {
			if (u.team && (u.boss || u.slot === "b")) Light.add(u.x, u.y - (u.boss ? 70 : 20), u.boss ? 260 : 90, EL[u.el].c, u.boss ? 0.7 : 0.45);
			else if (!u.team && u.r >= 3) Light.add(u.x, u.y - 30, 110, RAR[u.r].c, 0.5);
			if (u.st && u.st.burn) Light.add(u.x, u.y - 30, 100, "#ff8a3c", 0.7);
			if (u.inv > 0) Light.add(u.x, u.y - 30, 130, "#fff3b0", 0.8);
		}
		if (F.out && F.out.win) Light.add(609, 300, 900, "#fff3d0", Math.min(1, F.out.t));
		Light.end();
	} else if (A.tod === 2) {
		ctx.fillStyle = "rgba(20,24,70,.28)";
		ctx.fillRect(0, 0, W, H);
	}
	// свечения поверх света — огонь и снаряды остаются яркими
	if (fight) for (const p of F.proj) glow(p.x, p.y, p.o.big ? 30 : 20, (EL[p.el] || EL.phys).c, 0.8);
	for (const o of A.obs) if (!o.dead && o.d.fire) glow(o.x, o.y - 26, 40 + 5 * Math.sin(t * 11 + o.ph), (w.fire || FIRE0)[2], 0.45);
	wxTint(A);
	Parts.draw(2);
	vignette(A.tod === 2 ? 1 : 0.7);
}
// ввод в сцене: расстановка бойцов (до боя) и карточки по касанию
function fightInput(A, fight) {
	if (!fight) {
		area(ZONE.x0 - 10, A.y0 - 30, ZONE.x1 - ZONE.x0 + 20, FLD.y1 - A.y0 + 44, (px, py) => {
			const hit = G.slots.find((u) => u && u.placed && Math.abs(px - u.x) < 26 && py < u.y + 12 && py > u.y - 84);
			if (hit) {
				hit.placed = false;
				sel = G.slots.indexOf(hit);
				sfx("pick");
				return;
			}
			const u = G.slots[sel];
			if (u && !u.placed) {
				[u.x, u.y] = placeFree(A, clamp(px, ZONE.x0 + 16, ZONE.x1 - 16), clamp(py, A.y0 + 8, FLD.y1 - 4));
				u.placed = true;
				u.face = 1;
				u.born = t;
				u.z = 0;
				sel = G.slots.findIndex((q) => q && !q.placed);
				sfx("place");
				ring(u.x, u.y, 54, "#ffe9a8", 0.3, 4);
				burst(u.x, u.y, 6, { c: "rgba(230,220,200,.6)", k: 5, s: 6, e: 2, g: -10, sp: 50, life: 0.4, l: 0 });
			}
		});
	}
	for (const u of F.en) {
		const hh = uTop(u);
		area(u.x - u.rad - 8, u.y - hh, u.rad * 2 + 16, hh + 10, () => {
			pop = { u, mine: false };
		});
	}
	if (fight)
		for (const u of F.pl)
			area(u.x - 24, u.y - 84, 48, 92, () => {
				pop = { u, mine: false };
			});
}
function dFight() {
	const A = F.A,
		fight = S === "fight",
		wi = F.w,
		w = WORLDS[wi];
	fightCamera(fight);
	ctx.drawImage(A.floor, 0, 0, W, H);
	stageFx(A);
	heatHaze(A);
	const units = fight ? F.pl.concat(F.en) : G.slots.filter((u) => u && u.placed).concat(F.en),
		selU = !fight && sel >= 0 ? G.slots[sel] : null;
	fightGround(A, w, fight, units);
	fightDepth(A, w, wi, units, selU);
	fightTop(fight, wi);
	fightLight(A, w, fight, units);
	// --- полосы и цифры ---
	for (const u of units) uBar(u, fight);
	if (fight) dNums();
	ctx.restore();
	fightInput(A, fight);
	fightHud(fight);
}
function autoPlace() {
	const A = F.A,
		us = G.slots.filter(Boolean),
		front = us.filter((u) => u.rng < 140),
		back = us.filter((u) => u.rng >= 140),
		col = (l, x) =>
			l.forEach((u, i) => {
				const y = A.y0 + 14 + ((i + 0.5) * (FLD.y1 - A.y0 - 22)) / l.length;
				[u.x, u.y] = placeFree(A, x - (i % 2) * 46, y);
				u.placed = true;
				u.face = 1;
				u.z = 0;
				u.born = t + i * 0.05;
			});
	col(front, back.length ? 430 : 400);
	col(back, 230);
	sel = -1;
	sfx("place");
}
// ---------- интерфейс боя ----------
function wxChip(x, y) {
	const A = F.A,
		q = WX[A.wx],
		tod = ["День", "Закат", "Ночь"][A.tod],
		s = q.n + " · " + tod;
	ctx.font = font(14);
	const w = Math.max(150, ctx.measureText(s).width + 24);
	chip(x, y, w, 26);
	txo(s, x + 12, y + 14, 14, WORLDS[F.w].ui, "left");
	if (q.d) {
		ctx.font = font(13, false);
		const w2 = ctx.measureText(q.d).width + 20;
		chip(x, y + 28, w2, 22, "rgba(20,16,28,.7)");
		tx(q.d, x + 10, y + 40, 13, "#e8e2f4");
	}
}
function fightHud(fight) {
	const A = F.A,
		w = WORLDS[F.w];
	counter("coin", "coin_s", G.coin, 10, 8);
	counter("meat", "meat_s", G.meat, 120, 8);
	wxChip(10, 48);
	if (!fight) {
		const n = G.slots.filter((u) => u && u.placed).length,
			all = G.slots.filter(Boolean).length;
		txo(F.kind === "boss" ? "БОСС: " + F.en[0].n : n ? "Нажми на бойца на поле, чтобы переставить" : "Выбери бойца внизу и нажми на поле слева", 609, 82, 17, F.kind === "boss" ? "#ff8a7a" : "#fff3c0", "center");
		btn(499, 10, 220, 50, "В бой!", startFight, "#2e7d32", { dis: !n, pulse: n > 0, sz: 24 });
		if (n < all) btn(729, 14, 150, 42, "Расставить", autoPlace, "#8e24aa", { sz: 17 });
		// стрелка-подсказка над выбранным бойцом в панели
		const boss = F.en.find((e) => e.boss);
		if (boss) bossBar(boss);
	} else {
		const tl = Math.max(0, Math.ceil(F.timer)),
			low = tl <= 15;
		chip(569, 8, 80, 30, low && Math.sin(t * 10) > 0 ? "rgba(140,20,20,.9)" : "rgba(20,16,28,.82)");
		txo(Math.floor(tl / 60) + ":" + ("0" + (tl % 60)).slice(-2), 609, 24, 19, low ? "#ffb0a0" : "#fff", "center");
		const boss = F.en.find((e) => e.boss);
		if (boss) bossBar(boss);
		else {
			const al = F.en.length;
			txo("Врагов: " + al, 609, 52, 14, "#ffd0c0", "center");
		}
		if (F.flux) txo(F.flux.k === "haste" ? "Поток: скорость ×1.25" : "Поток: урон ×1.25", 609, boss ? 112 : 72, 15, "#ff9cf0", "center");
		btn(1000, 8, 64, 64, "x" + SPDX, () => (SPDX = (SPDX % 3) + 1), "#8e24aa", { sz: 22 });
	}
	hud();
	dFxScreen();
	if (F.out) {
		// развязка боя
		const k = Math.min(1, F.out.t / 0.5),
			wn = F.out.win;
		ctx.globalAlpha = k * 0.35;
		ctx.fillStyle = wn ? "#201400" : "#1a0004";
		ctx.fillRect(0, 0, W, H);
		ctx.globalAlpha = 1;
		const s = F.out.t < 0.3 ? ez.back(F.out.t / 0.3) : 1;
		if (wn) {
			glow(609, 200, 320 * s, "#ffd27a", 0.35);
			txo("ПОБЕДА!", 609, 200, Math.round(72 * s), "#ffe27a", "center", "#6a2a08");
		} else txo(F.out.time ? "ВРЕМЯ ВЫШЛО" : "ОТРЯД ПАЛ", 609, 200, Math.round(60 * s), "#ff6a5a", "center", "#2a0408");
	}
}
function bossBar(u) {
	const x = 329,
		y = 66,
		w = 560,
		k = u.hp / u.max,
		c = WORLDS[F.w].ui;
	txo(u.n, 609, 54, 17, "#fff", "center");
	pbar(x, y, w, 14, k, u.bph ? "#ff466e" : "#e8483c", { lag: u.hpl, lc: "#fff", sh: u.sh > 0 ? u.sh / u.max : 0 });
	// отметки фаз
	for (const g of u.gates) {
		const gx = x + Math.round(w * g);
		ctx.fillStyle = INK;
		ctx.fillRect(gx - 2, y - 4, 4, 22);
		ctx.fillStyle = k > g ? "#ffe27a" : "#6a6470";
		ctx.fillRect(gx - 1, y - 3, 2, 20);
	}
	uc("ui", "g_skull", x - 20, y + 7, AP);
	tx(fmt(Math.max(0, u.hp)) + " / " + fmt(u.max), 609, y + 8, 12, "#fff", "center", true);
	if (u.inv > 0 && S === "fight") txo("неуязвим", x + w + 10, y + 8, 13, "#fff3b0", "left");
	// значки статусов босса
	const ks = Object.keys(u.st || {}).filter((q) => ATL.ui["s_" + q]);
	ks.forEach((q, i) => us("ui", "s_" + q, x + i * 18, y + 20, AP));
}
// ---------- панель отряда (общая для карты, магазина, расстановки и боя) ----------
const SLX = (i) => 343 + i * 67.5,
	SLY = 470;
function hud() {
	const fight = S === "fight";
	n9("win", 323, 448, 572, 98, 17);
	for (let i = 0; i < 8; i++) {
		const x = Math.round(SLX(i)),
			y = SLY,
			u = G.slots[i],
			isSel = sel === i && S === "prep",
			dead = fight && u && (u.hp <= 0 || !F.pl.includes(u)),
			ready = fight && u && !dead && u.en >= 100;
		if (!u) {
			ctx.globalAlpha = 0.45;
			rframe(0, x, y, 60, 60);
			ctx.globalAlpha = 1;
			ctx.fillStyle = "rgba(10,8,16,.5)";
			ctx.fillRect(x + 6, y + 6, 48, 48);
			continue;
		}
		const lift = isSel ? -6 - 2 * Math.sin(t * 6) : 0;
		ctx.fillStyle = dead ? "#1c1820" : "#2a2238";
		ctx.fillRect(x + 4, y + 4 + lift, 52, 52);
		if (ready) glow(x + 30, y + 30, 46, "#ffd27a", 0.5 + 0.3 * Math.sin(t * 9));
		ctx.save();
		ctx.beginPath();
		ctx.rect(x + 4, y + 4 + lift, 52, 46);
		ctx.clip();
		ctx.globalAlpha = (S === "prep" && u.placed) || (fight && !F.pl.includes(u) && u.hp > 0) ? 0.4 : 1;
		uPort(u, x + 30, y + 62 + lift, AP, dead);
		ctx.restore();
		ctx.globalAlpha = 1;
		rframe(u.r || 0, x, y + lift, 60, 60);
		if (!dead) rfx(u.r || 0, x, y + lift, 60, 60, i * 0.37);
		pbar(x + 7, y + 49 + lift, 46, 4, Math.max(0, u.hp) / u.max, u.hp / u.max > 0.5 ? "#5fe06a" : u.hp / u.max > 0.25 ? "#ffd23c" : "#ff5a4a");
		if (fight && !dead && KIT[u.k]) {
			ctx.fillStyle = INK;
			ctx.fillRect(x + 5, y + 55 + lift, 50, 4);
			ctx.fillStyle = ready ? (Math.sin(t * 12) > 0 ? "#fff3a0" : "#ffb828") : "#58b8ff";
			ctx.fillRect(x + 7, y + 55 + lift, Math.round(46 * Math.min(1, u.en / 100)), 2);
		}
		if (u.skull) uc("ui", "skull_s", x + 49, y + 12 + lift, 1);
		if (S === "prep" && u.placed) uc("ui", "g_check", x + 30, y + 26, AP);
		if (dead) uc("ui", "g_skull", x + 30, y + 28, AP);
		if (ready && CFG.autoUlt === false) txo("УЛЬТА", x + 30, y - 6, 12, "#ffe27a", "center");
		if (isSel) arrowDown(x + 30, y - 12 - 3 * Math.sin(t * 6));
		if ((u.lv || 1) > 1) txo("" + u.lv, x + 10, y + 12 + lift, 12, "#fff", "center");
		area(x - 3, y - 4, 66, 70, () => slotTap(i));
	}
}
function slotTap(i) {
	const u = G.slots[i];
	if (!u) return;
	if (S === "shop") {
		if (G.sk) {
			if (u.skull) G.sm = "Монета-череп уже надета";
			else if (G.coin < 3) {
				G.sm = "Не хватает монет";
				sfx("err");
			} else {
				G.coin -= 3;
				u.skull = true;
				G.sk = false;
				G.sm = "Монета надета на " + u.n;
				sfx("coin");
			}
		} else if (G.rm) {
			if (G.slots.filter(Boolean).length > 1) {
				G.slots[i] = null;
				G.coin += 2;
				G.rm = false;
				G.sm = "Боец ушёл, +2 монеты";
				sfx("coin");
			}
		} else pop = { u, mine: true };
		return;
	}
	if (S === "prep") {
		if (u.placed) {
			u.placed = false;
			sel = i;
			sfx("pick");
		} else if (sel === i) pop = { u, mine: true };
		else {
			sel = i;
			sfx("pick");
		}
	} else if (S === "fight") {
		if (F.pl.includes(u) && u.en >= 100 && CFG.autoUlt === false) u.ultQ = 1;
		else pop = { u, mine: false };
	} else if (S === "map" || S === "msg") pop = { u, mine: true };
}
// кормление мясом: +10% здоровья (и полное лечение), +8% атаки
function feed(u) {
	if (G.meat <= 0) {
		sfx("err");
		toast("Нет мяса", "meat_s");
		return;
	}
	G.meat--;
	u.max = Math.round(u.max * 1.1);
	u.hp = u.max;
	u.atk = Math.round(u.atk * 1.08);
	u.lv = (u.lv || 1) + 1;
	pop.up = t;
	sfx("lvl");
}
// ---------- карточка бойца ----------
// сколько строк займёт текст при переносе по словам (как в txw)
function popLines(s, w, sz) {
	ctx.font = font(sz, false);
	let n = 0;
	("" + s).split("\n").forEach((par) => {
		let line = "";
		par.split(" ").forEach((wd) => {
			const q = line ? line + " " + wd : wd;
			if (ctx.measureText(q).width > w && line) {
				n++;
				line = wd;
			} else line = q;
		});
		n++;
	});
	return n;
}
function dPop() {
	if (!pop) return;
	const u = pop.u,
		mine = pop.mine && S !== "fight" && !u.team,
		K = KIT[u.k],
		x = 826,
		y = 84,
		w = 372,
		h = u.team
			? u.boss ? 262 : 214
			: (() => {
					// панель растягивается под длину описаний навыка и ульты
					const need = 190 + 17 + popLines(K.ab.d, w - 28, 12) * 15 + 8 + 17 + popLines(K.ult.d, w - 28, 12) * 15;
					return Math.min(H - y - 26, Math.max(mine ? 348 : 300, need + (mine ? 62 : 16)));
				})();
	area(0, 0, W, H, () => (pop = null));
	ctx.fillStyle = "rgba(8,6,14,.45)";
	ctx.fillRect(0, 0, W, H);
	panel(x, y, w, h);
	area(x - 12, y - 12, w + 24, h + 24, () => {});
	// портрет в рамке редкости
	const r = u.r || 0,
		up = pop.up ? Math.max(0, 1 - (t - pop.up) * 2.5) : 0;
	ctx.fillStyle = "#2a2238";
	ctx.fillRect(x + 12, y + 12, 68, 68);
	ctx.save();
	ctx.beginPath();
	ctx.rect(x + 12, y + 12, 68, 62);
	ctx.clip();
	uPort(u, x + 46, y + (u.team ? 76 : 84), u.team ? AP * (u.sc || 1) : AP);
	ctx.restore();
	rframe(u.team ? (u.boss ? 5 : u.slot === "b" ? 3 : u.slot === "m" ? 1 : 0) : r, x + 8, y + 8, 76, 76);
	if (!u.team) rfx(r, x + 8, y + 8, 76, 76);
	if (up > 0) glow(x + 46, y + 46, 90 * up + 40, "#ffe27a", up);
	txo(u.n, x + 96, y + 24, 19, "#fff", "left");
	if (u.team) {
		const e = EL[u.el];
		txo(u.boss ? "Босс мира" : u.slot === "b" ? "Элита" : u.slot === "m" ? "Стрелок" : "Обычный враг", x + 96, y + 48, 14, e.c, "left");
		tx("Стихия: " + ({ nature: "природа", fire: "огонь", ice: "лёд", poison: "яд", bolt: "молния", dark: "тьма", prism: "кристалл", chaos: "хаос", phys: "—", holy: "свет" }[u.el] || "—"), x + 96, y + 68, 13, "#d9d4e8");
	} else {
		txo(RAR[r].n, x + 96, y + 47, 14, RAR[r].c, "left");
		tx(K.role + " · ур. " + (u.lv || 1), x + 96, y + 68, 13, "#d9d4e8");
	}
	// характеристики
	const st = [
		["hp", fmt(Math.max(0, Math.round(u.hp))) + " / " + fmt(u.max), "Здоровье"],
		["atk", fmt(u.atk), "Атака"],
		["as", u.aspd + "/с", "Темп"],
		["arm", u.arm, "Броня"],
		["rng", u.rng, "Дальность"],
		["spd", u.spd, "Скорость"],
	];
	st.forEach((q, i) => {
		const cx = x + 12 + (i % 2) * 180,
			cy = y + 96 + ((i / 2) | 0) * 28;
		chip(cx, cy, 172, 24, "rgba(20,16,28,.6)");
		gly(q[0], cx + 14, cy + 12, 14, i === 0 ? "#ff6a6a" : "#ffd27a", "#17121f");
		tx(q[2], cx + 28, cy + 13, 12, "#b9b3c8");
		txo("" + q[1], cx + 164, cy + 13, 14, up > 0 && i < 2 ? "#aaff9a" : "#fff", "right");
	});
	let yy = y + 190;
	if (u.team) {
		const tips = u.boss
			? "Перед каждым приёмом на земле появляется метка — уводить бойцов нельзя, но оглушение и щиты спасают. На отметках здоровья босс меняет фазу и становится злее."
			: u.slot === "b"
				? "Таранит по прямой. Если на пути окажется камень — оглушит сам себя."
				: u.slot === "m"
					? "Плюётся издалека и накладывает эффект своей стихии."
					: "Медленный, но их бывает много.";
		txw(tips, x + 14, yy, w - 28, 16, 13, "#e8e2f4");
	} else {
		txo(K.ab.n, x + 14, yy, 14, EL[K.el].c, "left");
		tx("каждые " + K.ab.cd + " с", x + w - 14, yy, 12, "#b9b3c8", "right");
		yy += 17;
		yy += txw(K.ab.d, x + 14, yy, w - 28, 15, 12, "#e8e2f4") * 15 + 8;
		txo("Ульта: " + K.ult.n, x + 14, yy, 14, "#ffd27a", "left");
		yy += 17;
		yy += txw(K.ult.d, x + 14, yy, w - 28, 15, 12, "#e8e2f4") * 15;
		if (mine && S === "codex") btn(x + 14, y + h - 50, w - 28, 42, "Просмотр анимаций", () => { const hero = HEROES.find((h) => h.k === u.k); if (hero) codexTestOpen(hero); }, "#2e7d32", { sz: 15 });
		else if (mine) btn(x + 14, y + h - 50, w - 28, 42, "Накормить: +10% здоровья, +8% атаки", () => feed(u), "#2e7d32", { dis: G.meat <= 0, sz: 14, ic: "meat_s" });
	}
}
// обновление визуальной части (вне симуляции): частицы, таймеры эффектов, погода
const fxAlive = (f) => f.t < f.d,
	numAlive = (n) => n.t < (n.k === "crit" || n.k === "txt" ? 1.1 : 0.85);
function visTick(dt) {
	Parts.upd(dt * TSC);
	if (F && (S === "fight" || S === "prep")) {
		const sd = dt * TSC;
		wxEmit(F.A, dt);
		for (const f of F.fx) f.t += f.k === "banner" || f.k === "cut" || f.k === "go" || f.k === "flash" ? dt : sd;
		compact(F.fx, fxAlive);
		for (const n of F.nums) n.t += dt;
		compact(F.nums, numAlive);
		const us2 = S === "fight" ? F.pl.concat(F.en) : F.en;
		let fo = null;
		for (const u of us2) {
			const k = u.hp / u.max;
			u.hpl = u.hpl === undefined || u.hpl < k ? k : Math.max(k, u.hpl - dt * 0.45);
			const s = u.st;
			if (!s || S !== "fight") continue;
			const hy = u.y - (u.boss ? 70 : 28),
				rd = u.boss ? 60 : 16;
			if (s.burn && Rand.next() < dt * 14) Parts.add({ x: u.x + rr(-rd, rd), y: hy + rr(-10, 16), vx: rr(-10, 10), vy: rr(-80, -40), life: 0.5, c: pick(["#ff8a3c", "#ffe27a", "#ff5a1c"]), s: 4, k: 0, e: 0.3 });
			if (s.poison && Rand.next() < dt * 8) Parts.add({ x: u.x + rr(-rd, rd), y: hy + rr(-10, 10), vy: -30, life: 0.7, c: "#9be04e", s: 3, k: 3, r0: 2, r1: 7, w: 2, fy: 1 });
			if (s.chill && Rand.next() < dt * 7) Parts.add({ x: u.x + rr(-rd, rd), y: hy + rr(-20, 10), vx: rr(-10, 10), vy: 30, life: 0.7, c: "#dff8ff", s: 4, k: 4, vr: 6 });
			if (s.curse && Rand.next() < dt * 8) Parts.add({ x: u.x + rr(-rd, rd), y: hy + 10, vx: rr(-8, 8), vy: rr(-60, -30), life: 0.8, c: "#b06cff", s: 6, k: 1, wob: 20, wf: 5 });
			if (s.shock && Rand.next() < dt * 10) F.fx.push({ k: "bolt", x0: u.x + rr(-rd, rd), y0: hy - 20, x1: u.x + rr(-rd, rd), y1: hy + 20, c: "#fff27a", t: 0, d: 0.1, w: 2 });
			if (s.rage && Rand.next() < dt * 10) Parts.add({ x: u.x + rr(-rd, rd), y: u.y - 4, vy: rr(-120, -70), life: 0.4, c: "#ff5a3a", s: 4, k: 2, len: 0.06 });
			if (!u.team && u.r >= 4 && Rand.next() < dt * 5) Parts.add({ x: u.x + rr(-18, 18), y: u.y - rr(0, 60), vy: -24, life: 0.8, c: RAR[u.r].c, s: 3, k: 0, fi: 0.3 });
			if (u.boss) fo = u;
		}
		F.focus = fo ? { x: fo.x, y: fo.y - 60 } : F.focus;
		if (S === "fight" && !fo && F.pl[0]) {
			const e = F.en[0] || F.pl[0];
			F.focus = { x: e.x, y: e.y - 20 };
		}
	}
}

// ---------- частицы и числа по событиям боя ----------
// Логика (hurt/heal/deaths) только сообщает о событии; порядок подписчиков: сначала частицы
// (этот файл), затем звук (70_audio.js) — ровно тот порядок, что был при прямых вызовах.
Events.on("unit:healed", (tg, v) => {
	Fx.num(tg, "+" + fmt(v), "heal");
	burst(tg.x, tg.y - 30, 6, { c: ["#6dff7a", "#d6ffb0"], sp: 50, g: -120, life: 0.7, s: 4, rad: 24 });
});
Events.on("unit:hit", (tg, e) => {
	const c = EL[e.el] || EL.phys,
		hy = e.hy,
		el = e.el;
	if (e.dot) {
		Fx.num(tg, e.dm, "dot", c.c);
		return;
	}
	Fx.num(tg, e.crit ? fmt(e.dm) + "!" : e.dm, e.crit ? "crit" : tg.team ? "dmg" : "hit");
	burst(tg.x, hy, e.crit ? 14 : 5, { c: [c.c, c.c2], sp: e.crit ? 260 : 150, s: e.crit ? 6 : 4, life: 0.35, sv: 0.6 });
	if (el === "fire") burst(tg.x, hy, 3, { c: ["#ff8a3c", "#ffe27a"], k: 1, s: 7, g: -160, sp: 40, life: 0.5 });
	else if (el === "ice") burst(tg.x, hy, 4, { c: ["#ffffff", "#9fe8ff"], k: 4, s: 6, sp: 130, life: 0.45, g: 300 });
	else if (el === "poison") burst(tg.x, hy, 3, { c: "rgba(155,224,78,.6)", k: 5, s: 6, e: 2, g: -40, sp: 30, life: 0.6 });
	else if (el === "dark") burst(tg.x, hy, 4, { c: ["#b06cff", "#5a2a9a"], k: 1, s: 7, g: -60, sp: 60, life: 0.55 });
	else if (el === "holy") burst(tg.x, hy, 4, { c: ["#fff3b0", "#ffffff"], k: 1, s: 6, g: -90, sp: 70, life: 0.5 });
	else if (el === "bolt" || el === "prism") Fx.add({ k: "bolt", x0: tg.x + rr(-30, 30), y0: hy - 50, x1: tg.x, y1: hy, c: c.c, d: 0.12 });
	if (e.crit) {
		ring(tg.x, hy, 70, c.c2, 0.28, 6, 1, 1);
		Fx.add({ k: "star", x: tg.x, y: hy, c: c.c2, d: 0.2 });
		shake(0.12);
	}
});
Events.on("unit:phoenix", (u) => {
	Fx.add({ k: "pillar", x: u.x, y: u.y, c: "#ff9a3c", w: 70, d: 0.7 });
	burst(u.x, u.y - 30, 24, { c: ["#ff9a3c", "#ffe27a", "#ff4a2a"], sp: 220, s: 6, g: -200, life: 0.9 });
	Fx.txt(u.x, u.y - 100, "Феникс!", "#ffb03c", 22);
});
Events.on("coin:gain", (n, u) => {
	if (u) Fx.txt(u.x, u.y - 96, "+" + n, "#ffd600", 22);
});
Events.on("unit:died", (u, c) => {
	burst(u.x, u.y - 24, u.boss ? 50 : 16, { c: [c.c, c.c2, "#ffffff"], sp: u.boss ? 380 : 220, s: 6, sv: 0.8, life: 0.8, up: 60, fl: u.y + 6, bn: 0.4 });
	ring(u.x, u.y, u.boss ? 300 : 70, c.c, 0.45, u.boss ? 10 : 4);
	if (!u.team) for (let i = 0; i < 5; i++) Parts.add({ x: u.x + rr(-10, 10), y: u.y - 30, vx: rr(-10, 10), vy: rr(-80, -40), life: 1.2, c: "#cfe8ff", s: 7, k: 1, wob: 30, wf: 4, ph: rr(0, 6) });
});

