// ===== 15_ui.js =====
// ===== UI-ПРИМИТИВЫ: шрифт, панели, кнопки с анимацией, рамки редкости, полосы, тосты, переходы =====
const FNT = '"GameFont","Trebuchet MS",system-ui,sans-serif';
const INK = "#17121f";
const FS = 1.14;
const font = (sz, b = true) => (b ? "800 " : "600 ") + Math.round(sz * FS) + "px " + FNT;
function tx(s, x, y, sz = 16, c = "#fff", a = "left", b = false) {
	ctx.font = font(sz, b);
	ctx.fillStyle = c;
	ctx.textAlign = a;
	ctx.textBaseline = "middle";
	ctx.fillText(s, x, y);
}
// текст с тёмной обводкой — читается на любом фоне
function txo(s, x, y, sz = 16, c = "#fff", a = "left", oc = INK, b = true) {
	ctx.font = font(sz, b);
	ctx.textAlign = a;
	ctx.textBaseline = "middle";
	ctx.lineJoin = "round";
	ctx.lineWidth = Math.max(3, sz * 0.26);
	ctx.strokeStyle = oc;
	ctx.strokeText(s, x, y);
	ctx.fillStyle = c;
	ctx.fillText(s, x, y);
}
// перенос по словам; возвращает число строк
function txw(s, x, y, w, lh, sz, c = "#fff", a = "left", b = false) {
	ctx.font = font(sz, b);
	const out = [];
	("" + s).split("\n").forEach((par) => {
		let line = "";
		par.split(" ").forEach((wd) => {
			const q = line ? line + " " + wd : wd;
			if (ctx.measureText(q).width > w && line) {
				out.push(line);
				line = wd;
			} else line = q;
		});
		out.push(line);
	});
	out.forEach((l, i) => tx(l, x, y + i * lh, sz, c, a, b));
	return out.length;
}
function panel(x, y, w, h) {
	n9("win", x - 12, y - 12, w + 24, h + 24, 17);
}
// тёмная плашка под счётчики/подписи
function chip(x, y, w, h, c = "rgba(20,16,28,.82)", bc = "rgba(255,255,255,.14)") {
	ctx.fillStyle = INK;
	ctx.fillRect(x + 2, y, w - 4, h);
	ctx.fillRect(x, y + 2, w, h - 4);
	ctx.fillStyle = c;
	ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
	ctx.fillStyle = bc;
	ctx.fillRect(x + 4, y + 2, w - 8, 2);
}
const BTS = {};
function btn(x, y, w, h, s, f, bg = "#8e24aa", o = {}) {
	const key = s + "|" + (x | 0) + "|" + (y | 0),
		pr = t - (BTS[key] || -9) < 0.13,
		k = o.dis ? "d" : bg === "#2e7d32" || bg === "#4caf50" ? "g" : bg === "#c62828" || bg === "#ff5252" ? "r" : bg === "#555" ? "d" : "n",
		dy = pr ? 2 : 0;
	if (o.pulse && !pr) glow(x + w / 2, y + h / 2, w * 0.62, k === "g" ? "#7dff8a" : "#ffd27a", 0.16 + 0.1 * Math.sin(t * 4));
	n9(pr ? "bt_p" : "bt_" + k, x - 2, y - 2 + dy, w + 4, h + 4, 8);
	if ((k === "g" || o.pulse) && !pr) {
		// блик, пробегающий по главной кнопке
		const q = (t * 0.45 + x * 0.001) % 1.6;
		if (q < 1) {
			ctx.save();
			ctx.beginPath();
			ctx.rect(x + 4, y + 4, w - 8, h - 10);
			ctx.clip();
			ctx.fillStyle = "rgba(255,255,255,.2)";
			const bx = x - 30 + (w + 60) * q;
			ctx.beginPath();
			ctx.moveTo(bx, y);
			ctx.lineTo(bx + 18, y);
			ctx.lineTo(bx + 4, y + h);
			ctx.lineTo(bx - 14, y + h);
			ctx.fill();
			ctx.restore();
		}
	}
	const sz = o.sz || Math.min(22, h * 0.48);
	if (o.ic) {
		const tw = (ctx.font = font(sz)) && ctx.measureText(s).width;
		uc("ui", o.ic, x + w / 2 - tw / 2 - 12, y + h / 2 + dy - 1, AP);
		txo(s, x + w / 2 + 12, y + h / 2 + dy - 1, sz, o.dis ? "#a9a39a" : "#fff7e0", "center", "#2a1a12");
	} else txo(s, x + w / 2, y + h / 2 + dy - 1, sz, o.dis ? "#a9a39a" : "#fff7e0", "center", "#2a1a12");
	area(x, y, w, h, () => {
		BTS[key] = t;
		f();
	});
}
// квадратная кнопка-иконка (пауза, музыка, скорость, магазин)
// запас цели касания вокруг иконок-кнопок, px холста: иконка 68 px + 2×3 = 74 px холста,
// на телефоне (масштаб ≈ 0,66) это ≈ 49 px экрана; соседние иконки стоят через 74 px, больше нельзя
const HIT_PAD = 3;
function ibtn(n, x, y, f, o = {}) {
	const key = "i" + n + x,
		pr = t - (BTS[key] || -9) < 0.13,
		r = ATL.ui["ic_" + n];
	ctx.drawImage(IMG.ui, r[0], r[1], r[2], r[3], x, y + (pr ? 2 : 0), r[2] * AP, r[3] * AP);
	if (o.off) {
		ctx.strokeStyle = "#ff5252";
		ctx.lineWidth = 5;
		ctx.beginPath();
		ctx.moveTo(x + 14, y + r[3] * AP - 14);
		ctx.lineTo(x + r[2] * AP - 14, y + 14);
		ctx.stroke();
	}
	if (o.badge) {
		const b = 1 + 0.15 * Math.sin(t * 6);
		ctx.fillStyle = "#ff3d5a";
		ctx.beginPath();
		ctx.arc(x + r[2] * AP - 8, y + 10, 8 * b, 0, TAU);
		ctx.fill();
		txo("!", x + r[2] * AP - 8, y + 10, 14, "#fff", "center");
	}
	area(x - HIT_PAD, y - HIT_PAD, r[2] * AP + HIT_PAD * 2, r[3] * AP + HIT_PAD * 2, () => {
		BTS[key] = t;
		f();
	});
}
function ic(k, cx, cy, sz) {
	const n = k === "cell" || k === "cells" || k === "card" ? k : sz < 34 ? k + "_s" : k;
	if (ATL.ui[n]) uc("ui", n, cx, cy);
}
// рамка редкости (0 обычная … 5 мифическая) + «живые» эффекты для высоких редкостей
// bg = true — вместе с тонированной серединой (фон карточки); иначе только рамка поверх содержимого
function rframe(r, x, y, w, h, bg = false) {
	n9("fr" + Math.min(r, 5), x, y, w, h, 8, AP, ctx, !bg);
}
function rfx(r, x, y, w, h, ph = 0) {
	if (r < 2) return;
	const col = RAR[r].c;
	ctx.save();
	ctx.beginPath();
	ctx.rect(x + 6, y + 6, w - 12, h - 12);
	ctx.clip();
	if (r >= 2) {
		const q = (t * (r >= 4 ? 0.55 : 0.35) + ph) % 2;
		if (q < 1) {
			const bx = x - 40 + (w + 80) * q;
			ctx.fillStyle = r >= 4 ? "rgba(255,244,200,.26)" : "rgba(255,255,255,.14)";
			ctx.beginPath();
			ctx.moveTo(bx, y);
			ctx.lineTo(bx + 22, y);
			ctx.lineTo(bx - 8, y + h);
			ctx.lineTo(bx - 30, y + h);
			ctx.fill();
		}
	}
	ctx.restore();
	// тон радужного свечения квантован до 6°: glowSpr кэширует холст на каждый уникальный цвет, дробный
	// тон давал новый холст каждый кадр (утечка ~5 МБ за 10 с на телефоне), а шаг в 1° — до 360 холстов;
	// при прозрачности ≤ 0.16 шаг в 6° неразличим, палитра из 60 холстов заполняется за один оборот (3 с)
	if (r >= 3) glow(x + w / 2, y + h / 2, Math.max(w, h) * 0.8, r >= 5 ? `hsl(${(((t * 120 + ph * 90) % 360) / 6 | 0) * 6},90%,60%)` : col, 0.1 + 0.06 * Math.sin(t * 3 + ph));
	if (r >= 4) {
		// искры, бегущие по контуру
		const n = r >= 5 ? 6 : 4,
			per = 2 * (w + h);
		for (let i = 0; i < n; i++) {
			let d = ((t * 60 + (i * per) / n + ph * 50) % per + per) % per,
				px,
				py;
			if (d < w) (px = x + d), (py = y);
			else if (d < w + h) (px = x + w), (py = y + d - w);
			else if (d < 2 * w + h) (px = x + w - (d - w - h)), (py = y + h);
			else (px = x), (py = y + h - (d - 2 * w - h));
			const s = 2 + 2 * Math.abs(Math.sin(t * 7 + i));
			ctx.fillStyle = r >= 5 ? `hsl(${(t * 200 + i * 60) % 360},100%,78%)` : "#fff3b0";
			ctx.fillRect(Math.round(px - s), Math.round(py - 1), s * 2, 2);
			ctx.fillRect(Math.round(px - 1), Math.round(py - s), 2, s * 2);
		}
	}
}
// пиксельная полоса (здоровье, энергия, таймер)
function pbar(x, y, w, h, k, col, o = {}) {
	k = clamp(k, 0, 1);
	ctx.fillStyle = INK;
	ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
	ctx.fillStyle = o.bg || "#3a2f3f";
	ctx.fillRect(x, y, w, h);
	if (o.lag !== undefined && o.lag > k) {
		ctx.fillStyle = o.lc || "#fff";
		ctx.fillRect(x, y, Math.round(w * clamp(o.lag, 0, 1)), h);
	}
	ctx.fillStyle = col;
	ctx.fillRect(x, y, Math.round(w * k), h);
	ctx.fillStyle = "rgba(255,255,255,.32)";
	ctx.fillRect(x, y, Math.round(w * k), Math.max(1, h >> 2));
	ctx.fillStyle = "rgba(0,0,0,.22)";
	ctx.fillRect(x, y + h - Math.max(1, h >> 2), Math.round(w * k), Math.max(1, h >> 2));
	if (o.sh > 0) {
		ctx.fillStyle = "#8fd6ff";
		ctx.fillRect(x, y - 2, Math.round(w * clamp(o.sh, 0, 1)), 2);
	}
	if (o.seg) {
		ctx.fillStyle = INK;
		for (let i = 1; i < o.seg; i++) ctx.fillRect(x + Math.round((w * i) / o.seg) - 1, y, 2, h);
	}
}
// счётчик ресурса: число «докручивается», иконка подпрыгивает при изменении
const CNT = {};
function counter(id, icn, val, x, y) {
	const c = CNT[id] || (CNT[id] = { v: val, b: 0 });
	if (Math.abs(c.v - val) > 0.5) {
		c.v += (val - c.v) * 0.2 + Math.sign(val - c.v) * 0.3;
		if (Math.abs(c.v - val) < 0.6) {
			c.v = val;
			c.b = t;
		}
	} else c.v = val;
	const bump = Math.max(0, 1 - (t - c.b) * 5);
	chip(x, y, 104, 34);
	uc("ui", icn, x + 19, y + 17 - bump * 4, AP);
	txo(fmt(c.v), x + 40, y + 18, 20, bump > 0 ? "#fff3a0" : "#fff", "left");
}
// значки, летящие к счётчику/отряду (награды, покупки)
const Fly = {
	a: [],
	add(n, x0, y0, x1, y1, d = 0, cb) {
		this.a.push({ n, x0, y0, x1, y1, t0: t + d, cb, cx: (x0 + x1) / 2 + rr(-80, 80), cy: Math.min(y0, y1) - rr(40, 120) });
	},
	draw() {
		this.a = this.a.filter((f) => {
			const k = (t - f.t0) / 0.55;
			if (k < 0) return true;
			if (k >= 1) {
				if (f.cb) f.cb();
				return false;
			}
			const q = ez.io(k),
				u = 1 - q,
				x = u * u * f.x0 + 2 * u * q * f.cx + q * q * f.x1,
				y = u * u * f.y0 + 2 * u * q * f.cy + q * q * f.y1;
			if (ATL.ui[f.n]) uc("ui", f.n, x, y, AP);
			return true;
		});
	},
};
function toast(s, icn) {
	TOAST = { s, u: t + 2.4, t0: t, ic: icn };
}
function drawToast() {
	if (t >= TOAST.u || !TOAST.s) return;
	const k = Math.min(1, (t - (TOAST.t0 || 0)) * 5),
		o = Math.min(1, (TOAST.u - t) * 4),
		y = H + 60 - 196 * ez.back(k);
	ctx.font = font(18);
	const w = Math.max(220, ctx.measureText(TOAST.s).width + (TOAST.ic ? 86 : 48));
	ctx.globalAlpha = o;
	n9("win", 609 - w / 2, y - 24, w, 48, 17);
	if (TOAST.ic) uc("ui", TOAST.ic, 609 - w / 2 + 30, y);
	txo(TOAST.s, 609 + (TOAST.ic ? 14 : 0), y, 18, "#fff", "center");
	ctx.globalAlpha = 1;
}
// переход между экранами: плитки, уходящие по диагонали
let TRT = 0;
function drawTrans() {
	if (TRT <= 0) return;
	const k = TRT / 0.42,
		sz = 58,
		nx = Math.ceil(W / sz),
		ny = Math.ceil(H / sz);
	ctx.fillStyle = "#0c0a12";
	for (let j = 0; j < ny; j++)
		for (let i = 0; i < nx; i++) {
			const q = clamp(k * 2 - ((i + j) / (nx + ny)) * 1, 0, 1);
			if (q > 0) {
				const s = Math.ceil(sz * q) + 1;
				ctx.fillRect(i * sz + ((sz - s) >> 1), j * sz + ((sz - s) >> 1), s, s);
			}
		}
}
// всплывающая подсказка возле точки
function tip(x, y, title, body, col = "#fff") {
	ctx.font = font(14, false);
	const w = 250,
		lines = Math.ceil(ctx.measureText(body).width / (w - 24)) + 1,
		h = 40 + lines * 17;
	x = clamp(x - w / 2, 8, W - w - 8);
	y = clamp(y - h - 10, 70, H - h - 8);
	chip(x, y, w, h, "rgba(18,14,26,.96)");
	txo(title, x + 12, y + 17, 16, col);
	txw(body, x + 12, y + 40, w - 24, 17, 14, "#d9d4e8");
}

