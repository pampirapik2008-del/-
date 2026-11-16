// ===== 65_screens.js =====
// ===== ЭКРАНЫ: карта, события-награды, лавка, меню, выбор героя, настройки, итоги =====
let BGA = null, // последняя арена — фон для экрана наград
	TIPR = null,
	PK = -1,
	SRET = "menu",
	MERCH = { t: -9, s: "" };
const MAPA = { em: {}, wx: "clear", w: null };
const SCENE = { menu: "menu", settings: "menu", pick: "menu", codex: "menu", map: "map", msg: "map", world: "map", prep: "fight", fight: "fight", shop: "shop", win: "end", lose: "end" };
function stageBG(wi, dark = 0) {
	const im = IMG[WORLDS[wi].stage] || IMG.stage_taiga;
	ctx.drawImage(im, 0, 0, W, H);
	if (dark) {
		ctx.fillStyle = "rgba(10,8,18," + dark + ")";
		ctx.fillRect(0, 0, W, H);
	}
}
function title(s, y, c = "#fff3c0", sz = 26) {
	uc("ui", "banner", 609, y, AP);
	txo(s, 609, y + 7, sz, c, "center", "#2a1a12");
}
// верхняя полоса: ресурсы и кнопки
function resBar() {
	counter("coin", "coin_s", G.coin, 10, 8);
	counter("meat", "meat_s", G.meat, 120, 8);
}
// собранные реликвии: сетка иконок, наведение показывает подсказку
function relicRow(x0, y0, per = 9, pitch = 36, sz = 34) {
	const n = G.rel.length,
		max = per * 2;
	G.rel.slice(0, max).forEach((q, i) => {
		const x = x0 + (i % per) * pitch,
			y = y0 + ((i / per) | 0) * pitch;
		ctx.fillStyle = "#1c1626";
		ctx.fillRect(x + 3, y + 3, sz - 6, sz - 6);
		rframe(q.r, x, y, sz, sz);
		uc("ui", "r_" + q.id, x + sz / 2, y + sz / 2, (sz - 6) / 16);
		if (q.nw && t - q.nw < 1.2) glow(x + sz / 2, y + sz / 2, sz + 8, RAR[q.r].c, 1 - (t - q.nw) / 1.2);
		area(x, y, sz, sz, () => {
			TIPR = TIPR && TIPR.i === i ? null : { i, t0: t, x: x + sz / 2, y: y + sz + 6 };
			TIPN = null;
		});
	});
	if (n > max) txo("+" + (n - max), x0 + per * pitch + 6, y0 + sz * 0.8, 14, "#fff", "left");
}
function relicTip() {
	if (!TIPR || !G.rel[TIPR.i] || t - TIPR.t0 > 4) return (TIPR = null);
	const q = G.rel[TIPR.i],
		d = RELIC[q.id];
	tip(Math.max(140, TIPR.x), TIPR.y + 150, d.n + " · " + RAR[q.r].n, d.d(RAR[q.r].m), RAR[q.r].c);
}

// ---------- карта ----------
function nodeKind(n, i) {
	return i === 0 ? "start" : n.k || "rand";
}
function dMap() {
	const w = WORLDS[G.w],
		av = MV ? [] : avail(),
		lead = G.slots.find(Boolean);
	ctx.drawImage(MAPC, 0, 0, W, H);
	// блики воды
	for (const q of MAPL)
		for (let j = 0; j < 6; j++) {
			const a = Math.sin(t * 2.2 + j * 1.9 + q[0]);
			if (a > 0.55) {
				ctx.fillStyle = "rgba(255,255,255," + (a - 0.5) * 1.6 + ")";
				ctx.fillRect(Math.round(q[0] + q[2] * (0.24 + 0.52 * ((j * 0.37 + 0.13) % 1))) * 2, Math.round(q[1] + q[3] * (0.3 + 0.4 * ((j * 0.61 + 0.2) % 1))) * 2, 6, 2);
			}
		}
	// доступные пути — бегущие огоньки
	if (!MV)
		for (const b of av) {
			const A = N[G.cur],
				B = N[b],
				l = Math.hypot(B.x - A.x, B.y - A.y);
			for (let s = (t * 46) % 22; s < l - 20; s += 22) {
				if (s < 22) continue;
				const px = A.x + ((B.x - A.x) * s) / l,
					py = A.y + ((B.y - A.y) * s) / l + 6;
				ctx.fillStyle = "#3a2408";
				ctx.fillRect(Math.round(px / 2) * 2 - 4, Math.round(py / 2) * 2 - 4, 8, 8);
				ctx.fillStyle = "#ffe27a";
				ctx.fillRect(Math.round(px / 2) * 2 - 2, Math.round(py / 2) * 2 - 2, 4, 4);
			}
		}
	// узлы
	N.forEach((n, i) => {
		const k = nodeKind(n, i),
			cur = i === G.cur,
			vis = G.vis.has(i),
			can = av.includes(i),
			y = Math.round(n.y + (can ? -4 * Math.abs(Math.sin(t * 3 + i)) : 0)),
			x = Math.round(n.x);
		if (can) glow(x, n.y, 50, "#ffe27a", 0.4 + 0.2 * Math.sin(t * 4 + i));
		if (k === "boss") glow(x, n.y, 64, "#ff3a4a", 0.3 + 0.15 * Math.sin(t * 2.4));
		ctx.globalAlpha = vis && !cur ? 0.6 : 1;
		if (ATL.map["i_" + k]) uc("map", "i_" + k, x, y, AP);
		else {
			uc("ui", can ? "node_hi" : vis ? "node_off" : "node", x, y, AP);
			if (k === "chest") uc("ui", "chest0", x, y - 2, 1);
			else if (k === "secret") uc("ui", "g_secret", x, y, AP);
			else if (k === "rand") uc("ui", "g_rand", x, y, AP);
			else if (k === "start") uc("ui", "g_star", x, y, AP);
		}
		ctx.globalAlpha = 1;
		if (vis && !cur && i) uc("ui", "g_check", x + 16, y + 16, AP);
		if (k === "secret" && !vis && Rand.next() < 0.05) Parts.add({ x: x + rr(-20, 20), y: y + rr(-20, 10), vy: -20, life: 0.7, c: "#fff3a0", s: 4, k: 0, l: 2, fi: 0.3 });
		const lb = k === "boss" ? w.boss.n : NODE_LB[k];
		if (lb) txo(lb, x, y + 38, k === "boss" ? 14 : 12, k === "boss" ? "#ffb0a0" : vis ? "#b9b3c8" : "#fff", "center");
		area(x - 32, n.y - 32, 64, 72, () => {
			if (MV) return;
			if (can) walkTo(i);
			else {
				TIPN = { i, t0: t };
				TIPR = null;
			}
		});
	});
	// отряд на карте
	if (lead) {
		let x = N[G.cur].x,
			y = N[G.cur].y,
			an = "idle",
			face = 1;
		if (MV) {
			const k = ez.io(clamp((t - MV.t0) / MV.d, 0, 1)),
				A = N[MV.a],
				B = N[MV.b];
			x = lerp(A.x, B.x, k);
			y = lerp(A.y, B.y, k) - Math.abs(Math.sin(k * Math.PI * 5)) * 4;
			an = "walk";
			face = B.x >= A.x ? 1 : -1;
			if (Rand.next() < 0.4) Parts.add({ x, y: y + 6, vx: -face * 20, vy: -14, life: 0.4, c: "rgba(230,220,200,.6)", s: 5, k: 5, e: 2, l: 2 });
		}
		ctx.fillStyle = "rgba(10,8,20,.4)";
		ctx.beginPath();
		ctx.ellipse(x, y + 8, 16, 6, 0, 0, TAU);
		ctx.fill();
		uIdle(lead, Math.round(x), Math.round(y + 8), AP, face, G.w, an);
		// флажок отряда
		if (!MV) arrowDown(x, y - 78 - 4 * Math.sin(t * 4));
	}
	Parts.draw(2);
	vignette(0.8);
	// интерфейс
	resBar();
	const ttl = "Мир " + (G.w + 1) + " · " + w.n;
	ctx.font = font(20);
	const tw = Math.max(250, ctx.measureText(ttl).width + 48);
	chip(609 - tw / 2, 8, tw, 34);
	txo(ttl, 609, 26, 20, w.ui, "center");
	const steps = N[N.length - 1].ly || 1,
		st = N[G.cur].ly || 0;
	for (let i = 0; i <= steps; i++) {
		ctx.fillStyle = INK;
		ctx.fillRect(609 - steps * 9 + i * 18 - 5, 46, 10, 10);
		ctx.fillStyle = i < st ? w.ui : i === st ? "#fff" : i === steps ? "#ff5a5a" : "#4a4458";
		ctx.fillRect(609 - steps * 9 + i * 18 - 3, 48, 6, 6);
	}
	relicRow(10, 50);
	ctx.globalAlpha = G.shop ? 1 : 0.45;
	ibtn("cart", 994, 6, openShop, { badge: G.shop });
	ctx.globalAlpha = 1;
	hud();
	if (TIPN && t - TIPN.t0 < 3.2 && N[TIPN.i]) {
		const n = N[TIPN.i],
			k = nodeKind(n, TIPN.i);
		tip(n.x, n.y - 30, k === "boss" ? w.boss.n : k === "start" ? "Лагерь" : NODE_LB[k] || "Неизвестность", k === "start" ? "Отсюда начался поход" : (NODE_TIP[k] || "") + (G.vis.has(TIPN.i) ? " (пройдено)" : ""), "#ffe27a");
	}
	relicTip();
}

// ---------- событие: сундук, карточки с эффектом редкости ----------
function rays(cx, cy, r, len = 170) {
	ctx.save();
	ctx.globalCompositeOperation = "lighter";
	ctx.translate(cx, cy);
	ctx.rotate(t * 0.5);
	const n = r >= 5 ? 14 : r >= 4 ? 12 : 8;
	for (let j = 0; j < n; j++) {
		ctx.fillStyle = r >= 5 ? `hsla(${(j * 360) / n + t * 80},95%,62%,.20)` : RAR[r].c;
		ctx.globalAlpha = r >= 5 ? 1 : j & 1 ? 0.2 : 0.12;
		ctx.beginPath();
		ctx.moveTo(0, 0);
		const a = (j / n) * TAU,
			wd = (TAU / n) * 0.3;
		ctx.lineTo(Math.cos(a - wd) * len, Math.sin(a - wd) * len);
		ctx.lineTo(Math.cos(a + wd) * len, Math.sin(a + wd) * len);
		ctx.fill();
	}
	ctx.restore();
}
function cardFace(c, i, x, y, w, h) {
	const r = c.t === "relic" || c.t === "hero" ? c.r : 0,
		cx = x + w / 2,
		col = RAR[r].c;
	ctx.fillStyle = "#1c1626";
	ctx.fillRect(x + 6, y + 6, w - 12, h - 12);
	if (r > 0) {
		ctx.globalAlpha = 0.16;
		ctx.fillStyle = col;
		ctx.fillRect(x + 6, y + 6, w - 12, 74);
		ctx.globalAlpha = 1;
	}
	if (c.t === "relic") {
		const d = RELIC[c.id];
		glow(cx, y + 48, 44, col, 0.4 + 0.15 * Math.sin(t * 3 + i));
		uc("ui", "r_" + c.id, cx, Math.round(y + 48 + Math.sin(t * 2 + i) * 2), 4);
		const nl = txw(d.n, cx, y + 96, w - 20, 16, 14, "#fff", "center", true);
		txo(RAR[r].n, cx, y + 96 + nl * 16 + 2, 12, col, "center");
		txw(d.d(RAR[r].m), cx, y + 96 + nl * 16 + 22, w - 22, 14, 11, "#d9d4e8", "center");
	} else if (c.t === "hero") {
		glow(cx, y + 62, 54, col, 0.3);
		ctx.fillStyle = "rgba(10,8,20,.4)";
		ctx.beginPath();
		ctx.ellipse(cx, y + 106, 26, 7, 0, 0, TAU);
		ctx.fill();
		uIdle(c.u, cx, y + 106, 3, 1, G.w, t - (c.rt || 0) < 1.2 ? "win" : "idle");
		txo(c.u.n, cx, y + 126, 15, "#fff", "center");
		txo(RAR[r].n, cx, y + 145, 12, col, "center");
		tx(KIT[c.u.k].role, cx, y + 162, 12, "#d9d4e8", "center");
		tx("HP " + fmt(c.u.max) + " · ATK " + fmt(c.u.atk), cx, y + 180, 11, "#b9b3c8", "center");
	} else if (c.t === "res") {
		glow(cx, y + 78, 50, c.ic === "coin" ? "#ffd23c" : "#ff8a6a", 0.35);
		uc("ui", c.ic, cx, Math.round(y + 78 + Math.sin(t * 3 + i) * 3), 3);
		const k = clamp((t - (c.rt || t)) / 0.5, 0, 1);
		txo("+" + Math.round(c.n * k), cx, y + 140, 30, "#fff3a0", "center");
		tx(c.ic === "coin" ? "монеты" : "мясо", cx, y + 166, 13, "#d9d4e8", "center");
	} else {
		gly(c.ic || "hp", cx, y + 70, 56, "#ff6a6a", "#17121f");
		txw(c.s, cx, y + 124, w - 20, 17, 14, "#fff", "center", true);
		if (c.s2) txw(c.s2, cx, y + 162, w - 20, 15, 12, "#d9d4e8", "center");
	}
	rframe(r, x, y, w, h);
	rfx(r, x, y, w, h, i * 0.4);
}
function dMsg() {
	const e = EV;
	if (!e) {
		State.go("map");
		return dMap();
	}
	if (e.bg && BGA) {
		ctx.drawImage(BGA.floor, 0, 0, W, H);
		resBar();
	} else if (G.arena) {
		stageBG(G.w);
		resBar();
	} else dMap();
	hits = [];
	const a = Math.min(1, (t - e.t0) * 5),
		n = e.cards.length,
		cw = 164,
		ch = 206,
		gap = 18,
		tot = n * cw + (n - 1) * gap,
		pw = Math.max(460, tot + 90),
		ph = (n ? ch + 24 : 0) + 150 + (e.stats ? 26 : 0),
		px = 609 - pw / 2,
		py = Math.round(270 - ph / 2) + 6;
	ctx.fillStyle = "rgba(8,6,14," + 0.72 * a + ")";
	ctx.fillRect(0, 0, W, H);
	const skip = () => {
		if (!e.open) {
			e.open = 1;
			e.to = t;
			sfx("chest");
			shake(0.15);
		} else if (t < rt(n - 1) + 0.3) e.to = t - 10;
	};
	const rt = (i) => (e.to || e.t0) + (e.chest === undefined ? 0.3 : 0.55) + i * 0.32;
	area(0, 0, W, H, skip);
	ctx.save();
	ctx.translate(609, 270);
	ctx.scale(0.9 + 0.1 * ez.back(a), 0.9 + 0.1 * ez.back(a));
	ctx.translate(-609, -270);
	ctx.globalAlpha = a;
	panel(px, py, pw, ph);
	title(e.title, py + 8);
	if (e.sub) txo(e.sub, 609, py + 56, 15, "#e8e2f4", "center", INK, false);
	let cy = py + 78;
	if (e.stats) {
		const s = e.stats.join("   ·   ");
		tx(s, 609, cy + 4, 13, "#b9b3c8", "center");
		cy += 26;
	}
	ctx.globalAlpha = 1;
	// сундук
	const best = e.cards.reduce((m, c) => Math.max(m, c.r || 0), 0);
	if (e.chest !== undefined && !e.open) {
		const sh = Math.sin(t * 26) * Math.max(0, Math.sin(t * 3)) * 4;
		glow(609, cy + 96, 110, RAR[best].c, 0.25 + 0.15 * Math.sin(t * 5));
		uc("ui", "chest0", Math.round(609 + sh), cy + 100, 4);
		txo("Нажми, чтобы открыть", 609, cy + 190, 15, "#fff3c0", "center");
		if (t - e.t0 > 1.6) skip();
	} else {
		if (e.chest !== undefined) {
			const k = t - e.to;
			if (k < 0.75) {
				ctx.globalAlpha = k < 0.45 ? 1 : 1 - (k - 0.45) / 0.3;
				glow(609, cy + 90, 90 + 240 * k, RAR[best].c, 0.7 * (1 - k));
				uc("ui", k < 0.14 ? "chest1" : "chest2", 609, cy + 100, 4);
				ctx.globalAlpha = 1;
				if (!e.cf) {
					e.cf = 1;
					burst(609, cy + 80, 30 + best * 12, { c: [RAR[best].c, "#fff3a0", "#ffffff"], sp: 380, s: 6, sv: 0.8, life: 0.9, up: 180, l: 2 });
					if (best >= 3) shake(0.2 + best * 0.08);
				}
			}
		}
		const x0 = 609 - tot / 2;
		e.cards.forEach((c, i) => {
			const k = (t - rt(i)) / 0.34;
			if (e.chest !== undefined && t - e.to < 0.35 + i * 0.1) return;
			const r = c.t === "relic" || c.t === "hero" ? c.r : 0,
				x = x0 + i * (cw + gap),
				picked = e.pick && e.sel === i,
				yy = cy + (picked ? -8 : 0) + (k < 0 ? 0 : -6 * Math.sin(Math.PI * clamp(k, 0, 1))),
				cx = x + cw / 2;
			c.x = cx;
			c.y = yy + ch / 2;
			if (k >= 0.5 && !e.rv[i]) {
				// момент раскрытия: звук и эффект по редкости
				e.rv[i] = 1;
				c.rt = t;
				sfx(c.t === "res" ? (c.ic === "coin" ? "coin" : "pick") : c.t === "txt" ? "heal" : "rev" + r);
				burst(cx, yy + ch / 2, 10 + r * 9, { c: [RAR[r].c, "#ffffff"], sp: 200 + r * 50, s: 5, sv: 0.8, life: 0.7 + r * 0.1, l: 2, g: 200 });
				if (r >= 3) ring(cx, yy + ch / 2, 150 + r * 30, RAR[r].c, 0.6, 6, 1, 2);
				if (r >= 4) {
					shake(r >= 5 ? 0.5 : 0.3);
					FLASH = { c: RAR[r].c, t0: t, d: r >= 5 ? 0.7 : 0.45 };
				}
			}
			if (k >= 0.5 && r >= 3) rays(cx, yy + ch / 2, r, 150 + r * 14);
			if (k >= 0.5 && r >= 4 && Rand.next() < 0.3) Parts.add({ x: cx + rr(-80, 80), y: yy + rr(0, ch), vy: -40, life: 1, c: r >= 5 ? `hsl(${(Rand.next() * 360) | 0},95%,70%)` : "#fff3a0", s: 4, k: 0, l: 2, fi: 0.3 });
			const fl = Math.abs(Math.cos(Math.PI * clamp(k, 0, 1)));
			ctx.save();
			ctx.translate(cx, 0);
			ctx.scale(Math.max(0.03, fl), 1);
			ctx.translate(-cx, 0);
			if (e.pick && e.sel >= 0 && !picked) ctx.globalAlpha = 0.55;
			if (k < 0.5) {
				ctx.fillStyle = "#231b30";
				ctx.fillRect(x + 6, yy + 6, cw - 12, ch - 12);
				rframe(0, x, yy, cw, ch);
				uc("ui", "g_rand", cx, yy + ch / 2, 4);
			} else cardFace(c, i, x, yy, cw, ch);
			ctx.restore();
			if (picked) {
				ctx.strokeStyle = "#ffe27a";
				ctx.lineWidth = 4;
				ctx.strokeRect(x - 4, yy - 4, cw + 8, ch + 8);
			}
			if (e.pick && k >= 1)
				area(x, cy - 8, cw, ch + 8, () => {
					e.sel = i;
					sfx("pick");
				});
		});
		const done = t > rt(n - 1) + 0.45 || !n;
		if (done) {
			const by = py + ph - 56;
			if (e.pick) btn(509, by, 200, 46, e.sel >= 0 ? "Забрать" : "Выбери карту", () => e.sel >= 0 && evClose(), "#2e7d32", { dis: e.sel < 0, pulse: e.sel >= 0, sz: 19 });
			else btn(529, by, 160, 46, "Дальше", evClose, "#2e7d32", { pulse: 1, sz: 20 });
		}
	}
	ctx.restore();
	Parts.draw(2);
}
let FLASH = null;

// ---------- лавка ----------
const SHOPG = [
	["relic", 0],
	["relic", 1],
	["relic", 2],
	["rr"],
	null,
	["b", "atk"],
	["b", "hp"],
	["b", "arm"],
	["b", "as"],
	["b", "spd"],
	["s", "heal"],
	["s", "meat"],
	["s", "sk"],
	["s", "rm"],
	null,
];
const BCOL = { atk: "#ff6a5a", hp: "#6dff7a", arm: "#8fd6ff", as: "#ffd23c", spd: "#c9a0ff" };
function shopInfo(c) {
	if (!c) return null;
	if (c[0] === "relic") {
		const q = G.stock.rel[c[1]],
			d = RELIC[q.id];
		return { n: d.n, d: d.d(RAR[q.r].m), p: relPrice(q.r, G.w), r: q.r, sold: q.sold, sub: RAR[q.r].n + " реликвия", q };
	}
	if (c[0] === "rr") return { n: "Обновить товар", d: "Торговец достанет три новые реликвии взамен непроданных.", p: rrPrice(), r: 0 };
	const it = SHOP.find((s) => s.k === c[1]);
	return { n: it.t, d: it.dd, p: it.p(), r: 0, it, own: c[0] === "b" ? G.bf[c[1]] : undefined };
}
function shopAct(c) {
	if (c[0] === "relic") {
		if (buyRelic(c[1])) {
			MERCH.t = t;
			G.rel[G.rel.length - 1].nw = t;
			const q = G.stock.rel[c[1]];
			burst(170, 300, 16 + q.r * 8, { c: [RAR[q.r].c, "#ffffff"], sp: 260, s: 5, life: 0.8, l: 2, g: 200 });
			if (q.r >= 4) {
				shake(0.3);
				FLASH = { c: RAR[q.r].c, t0: t, d: 0.4 };
			}
			SS.sel = -1;
		}
	} else if (c[0] === "rr") reroll();
	else {
		const it = SHOP.find((s) => s.k === c[1]),
			before = G.coin;
		buy(it);
		if (G.coin < before) {
			MERCH.t = t;
			if (c[0] === "b") G.slots.forEach((u, i) => u && burst(SLX(i) + 30, SLY + 30, 6, { c: [BCOL[c[1]], "#ffffff"], sp: 120, s: 4, life: 0.6, l: 2, g: -100 }));
			if (c[1] === "heal") sfx("heal");
		}
	}
}
function dShop() {
	const w = WORLDS[G.w],
		st = shopStock();
	stageBG(G.w, 0.5);
	// прилавок и торговец
	const mx = 168,
		my = 438,
		buyT = t - MERCH.t;
	Light.begin("#8a7a9a");
	Light.add(mx - 96, my - 110, 300, "#ffd27a", 1);
	Light.add(mx + 40, my - 30, 260, "#ffb060", 0.8);
	Light.end();
	const mi = TINTC.merch || (TINTC.merch = recolor(IMG.heroes, [{ h: [180, 262], to: 26, sat: 1, val: 1.05 }, { h: [80, 172], to: 288, sat: 0.85, val: 0.95 }])),
		A = ATL.heroes.mage,
		f = buyT < 0.6 ? aFrame(A, "cast", 0) : aFrame(A, "idle", 0, t * 2.2);
	ctx.fillStyle = "rgba(10,8,20,.45)";
	ctx.beginPath();
	ctx.ellipse(mx, my - 20, 120, 26, 0, 0, TAU);
	ctx.fill();
	ub("props", "lantern", mx - 110, my - 14, AP);
	glow(mx - 84, my - 100, 30 + 3 * Math.sin(t * 7), "#ffd27a", 0.6);
	fr(mi, f, mx, my - 30 + (buyT < 0.3 ? -10 * Math.sin((buyT / 0.3) * Math.PI) : 0), 1, 4, 1 + 0.015 * Math.sin(t * 3));
	ub("props", "log", mx + 6, my + 2, 3);
	uc("ui", "chest2", mx + 86, my - 46, AP);
	uc("ui", "chest0", mx - 52, my - 40, AP);
	uc("ui", "coin", mx + 30, my - 40, 1);
	uc("ui", "meat", mx + 8, my - 42, 1);
	if (Rand.next() < 0.08) Parts.add({ x: mx + 86 + rr(-20, 20), y: my - 60, vy: -30, life: 0.8, c: "#fff3a0", s: 4, k: 0, l: 2, fi: 0.3 });
	// товары
	title(G.arena ? "Лавка · волна " + G.wave : "Лавка гоблина", 34, "#fff3c0", 24);
	resBar();
	const X0 = 346,
		Y0 = 74,
		CW = 166,
		CH = 112,
		GX = 6,
		GY = 8;
	["Реликвии", "Значки отряда", "Припасы"].forEach((s, r) => {
		ctx.save();
		ctx.translate(X0 - 16, Y0 + r * (CH + GY) + CH / 2);
		ctx.rotate(-Math.PI / 2);
		txo(s, 0, 0, 11, "#cfc9db", "center");
		ctx.restore();
	});
	SHOPG.forEach((c, idx) => {
		if (!c) return;
		const col = idx % 5,
			row = (idx / 5) | 0,
			inf = shopInfo(c),
			sl = SS.sel === idx,
			x = X0 + col * (CW + GX),
			y = Y0 + row * (CH + GY) - (sl ? 4 : 0),
			can = G.coin >= inf.p && !inf.sold,
			act = (c[1] === "sk" && G.sk) || (c[1] === "rm" && G.rm);
		ctx.fillStyle = sl ? "#2e2440" : "#1c1626";
		ctx.fillRect(x + 5, y + 5, CW - 10, CH - 10);
		if (inf.r > 0) {
			ctx.globalAlpha = 0.18;
			ctx.fillStyle = RAR[inf.r].c;
			ctx.fillRect(x + 5, y + 5, CW - 10, CH - 10);
			ctx.globalAlpha = 1;
		}
		if (inf.sold) ctx.globalAlpha = 0.35;
		// значок товара
		const ix = x + 36,
			iy = y + 40;
		if (c[0] === "relic") {
			if (inf.q.nw && t - inf.q.nw < 0.5) glow(ix, iy, 60, "#ffffff", 1 - (t - inf.q.nw) * 2);
			glow(ix, iy, 30, RAR[inf.r].c, 0.4);
			uc("ui", "r_" + inf.q.id, ix, Math.round(iy + Math.sin(t * 2 + idx) * 2), 3);
		} else if (c[0] === "rr") {
			ctx.save();
			ctx.translate(ix, iy);
			ctx.rotate(t * 1.2);
			uc("ui", "g_arrow", 0, -12, AP);
			ctx.rotate(Math.PI);
			uc("ui", "g_arrow", 0, -12, AP);
			ctx.restore();
		} else if (c[0] === "b") {
			ctx.fillStyle = INK;
			ctx.fillRect(ix - 22, iy - 22, 44, 44);
			ctx.fillStyle = BCOL[c[1]];
			ctx.fillRect(ix - 19, iy - 19, 38, 38);
			ctx.fillStyle = "rgba(255,255,255,.35)";
			ctx.fillRect(ix - 19, iy - 19, 38, 6);
			gly(c[1], ix, iy + 1, 24, "#17121f");
		} else if (c[1] === "heal") {
			gly("hp", ix, iy, 40, "#6dff7a", "#17121f");
			txo("+", ix, iy - 2, 22, "#fff", "center");
		} else if (c[1] === "meat") uc("ui", "meat", ix, iy, AP);
		else if (c[1] === "sk") uc("ui", "skull", ix, iy, AP);
		else {
			uc("ui", "g_skull", ix - 6, iy, AP);
			uc("ui", "g_arrow", ix + 16, iy, AP);
		}
		txw(inf.n.replace("Значок: ", ""), x + 66, y + 22, CW - 74, 15, 13, "#fff", "left", true);
		if (inf.sub) tx(RAR[inf.r].n, x + 66, y + 62, 11, RAR[inf.r].c);
		if (inf.own !== undefined) tx("куплено: " + inf.own, x + 66, y + 62, 11, "#b9b3c8");
		// цена
		ctx.globalAlpha = inf.sold ? 0.35 : 1;
		chip(x + 10, y + CH - 36, CW - 20, 26, act ? "rgba(46,125,50,.9)" : can ? "rgba(20,16,28,.85)" : "rgba(60,16,20,.85)");
		if (inf.sold) txo("Продано", x + CW / 2, y + CH - 22, 13, "#b9b3c8", "center");
		else if (act) txo("Выбери бойца внизу", x + CW / 2, y + CH - 22, 12, "#fff", "center");
		else if (inf.p > 0) {
			uc("ui", "coin_s", x + CW / 2 - 16, y + CH - 23, AP);
			txo("" + inf.p, x + CW / 2 + 4, y + CH - 22, 15, can ? "#fff3a0" : "#ff8a7a", "left");
		} else txo(c[1] === "rm" ? "Вернёт 2 монеты" : "Бесплатно", x + CW / 2, y + CH - 22, 12, "#fff3a0", "center");
		ctx.globalAlpha = 1;
		rframe(inf.r, x, y, CW, CH);
		if (!inf.sold) rfx(inf.r, x, y, CW, CH, idx * 0.3);
		if (sl) {
			ctx.strokeStyle = "#ffe27a";
			ctx.lineWidth = 3;
			ctx.strokeRect(x - 3, y - 3, CW + 6, CH + 6);
		}
		area(x, Y0 + row * (CH + GY), CW, CH, () => {
			if (inf.sold) return;
			if (SS.sel === idx) shopAct(c);
			else {
				SS.sel = idx;
				G.sm = "";
				sfx("pick");
			}
		});
	});
	// реплика торговца
	const selc = SS.sel >= 0 ? SHOPG[SS.sel] : null,
		inf = selc ? shopInfo(selc) : null,
		bx = 14,
		by = 84,
		bw = 312,
		bh = 168;
	chip(bx, by, bw, bh, "rgba(18,14,26,.94)");
	ctx.fillStyle = "rgba(18,14,26,.94)";
	ctx.fillRect(bx + 120, by + bh - 2, 16, 8);
	ctx.fillRect(bx + 124, by + bh + 6, 8, 6);
	if (inf && !inf.sold) {
		txo(inf.n, bx + 14, by + 20, 16, RAR[inf.r].c === RAR[0].c ? "#ffe27a" : RAR[inf.r].c, "left");
		txw(inf.d, bx + 14, by + 46, bw - 28, 16, 13, "#e8e2f4");
	} else {
		const lines = ["Заходи, герой! Лучшие товары на всём тракте.", "Реликвии действуют сразу на весь отряд.", "Значки усиливают всех — и новичков тоже.", "Редкий товар не залёживается. Бери, пока есть!"];
		txo("Гоблин-торговец", bx + 14, by + 20, 16, "#ffe27a", "left");
		txw(lines[((t / 6) | 0) % lines.length], bx + 14, by + 46, bw - 28, 16, 13, "#e8e2f4");
	}
	if (G.sm) txw(G.sm, bx + 14, by + bh - 34, bw - 28, 15, 13, "#aaff9a", "left", true);
	// кнопки
	if (inf && !inf.sold) {
		const can = G.coin >= inf.p;
		btn(14, 462, 300, 66, inf.p > 0 ? "Купить · " + inf.p : selc[1] === "rm" ? (G.rm ? "Отмена" : "Выбрать бойца") : "Взять", () => shopAct(selc), can ? "#2e7d32" : "#555", { dis: !can, pulse: can, sz: 22, ic: inf.p > 0 ? "coin_s" : undefined });
	} else txw("Нажми на товар, чтобы узнать подробности. Второе нажатие — покупка.", 20, 478, 290, 16, 13, "#e8e2f4");
	btn(
		906,
		462,
		300,
		66,
		G.arena ? "Следующая волна" : "В путь",
		() => {
			G.rm = G.sk = false;
			if (G.arena) arenaNext();
			else {
				State.go("map");
				autosave();
			}
		},
		"#8e24aa",
		{ sz: 22 },
	);
	relicRow(10, 46, 11, 30, 28);
	hud();
	Parts.draw(2);
	relicTip();
}

// ---------- меню ----------
function menuBG(pan = true) {
	const im = IMG.menu_bg,
		mw = im.width * 2,
		off = pan ? Math.round(((mw - W) / 2) * (1 + Math.sin(t * 0.045)) / 2) * 2 : 360;
	ctx.drawImage(im, -off, 0, mw, H);
	// туман, лучи
	const fog = fogSpr();
	ctx.globalAlpha = 0.34;
	for (let i = 0; i < 2; i++) {
		const ox = (((t * (i ? 16 : -10) - off * 0.5) % 1024) + 1024) % 1024;
		ctx.drawImage(fog, ox - 1024, 250 + i * 60, 1024, 170);
		ctx.drawImage(fog, ox, 250 + i * 60, 1024, 170);
		ctx.drawImage(fog, ox + 1024, 250 + i * 60, 1024, 170);
	}
	ctx.globalAlpha = 1;
	ctx.save();
	ctx.globalCompositeOperation = "lighter";
	for (let i = 0; i < 5; i++) {
		const x = 100 + i * 270 - off * 0.3 + Math.sin(t * 0.3 + i) * 20;
		ctx.globalAlpha = 0.05 + 0.03 * Math.sin(t * 0.7 + i * 2);
		ctx.fillStyle = "#ffd9a0";
		ctx.beginPath();
		ctx.moveTo(x, 0);
		ctx.lineTo(x + 80, 0);
		ctx.lineTo(x - 150, 400);
		ctx.lineTo(x - 290, 400);
		ctx.fill();
	}
	ctx.restore();
}
function campScene(cx, cy) {
	// костёр, вокруг — герои; свет от огня
	const hs = HEROES.slice(0, 4).map((h, i) => ({ h, x: cx + [-108, -52, 62, 118][i], y: cy + [6, 16, 16, 6][i], f: i < 2 ? 1 : -1 }));
	ctx.fillStyle = "rgba(10,8,20,.4)";
	for (const q of hs) {
		ctx.beginPath();
		ctx.ellipse(q.x, q.y + 1, 18, 6, 0, 0, TAU);
		ctx.fill();
	}
	hs.forEach((q, i) => uIdle(q.h, q.x, q.y, AP, q.f, 0, "idle"));
	drawCampfire(cx, cy + 34, AP, 0);
	if (Rand.next() < 0.1) Parts.add({ x: cx + rr(-8, 8), y: cy - 10, vx: rr(-20, 20), vy: rr(-90, -50), life: rr(0.6, 1.2), c: "#ffd45e", s: 2, k: 0, g: -10, l: 2 });
}
function logo(y) {
	const bob = Math.sin(t * 1.4) * 3,
		line = (s, yy, sz) => {
			ctx.font = "800 " + sz + "px " + FNT; // логотип — без общего масштаба
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.lineJoin = "round";
			ctx.lineWidth = 14;
			ctx.strokeStyle = "#1a0c22";
			ctx.strokeText(s, 609, yy + 5);
			ctx.lineWidth = 8;
			ctx.strokeStyle = "#5a1a08";
			ctx.strokeText(s, 609, yy);
			const g = ctx.createLinearGradient(0, yy - sz / 2, 0, yy + sz / 2);
			g.addColorStop(0, "#fff7c8");
			g.addColorStop(0.45, "#ffd23c");
			g.addColorStop(0.55, "#ffa62a");
			g.addColorStop(1, "#e8641c");
			ctx.fillStyle = g;
			ctx.fillText(s, 609, yy);
		};
	glow(609, y + 36, 380, "#ff8a3c", 0.16 + 0.05 * Math.sin(t * 2));
	line("ПРОБУЖДЕНИЕ", y + bob, 66);
	line("МОНСТРОВ", y + 62 + bob, 66);
	// блик по буквам
	const q = (t * 0.35) % 2.4;
	if (q < 1) {
		ctx.save();
		ctx.globalCompositeOperation = "lighter";
		ctx.globalAlpha = 0.25 * Math.sin(q * Math.PI);
		ctx.fillStyle = "#fff";
		ctx.beginPath();
		const bx = 300 + 640 * q;
		ctx.moveTo(bx, y - 40);
		ctx.lineTo(bx + 30, y - 40);
		ctx.lineTo(bx - 10, y + 100);
		ctx.lineTo(bx - 40, y + 100);
		ctx.fill();
		ctx.restore();
	}
}
function dMenu() {
	menuBG();
	Light.begin("#7a78b0");
	Light.add(232, 440, 420, "#ffb060", 0.95 + 0.05 * Math.sin(t * 9));
	Light.add(609, 110, 520, "#ffe0b0", 0.75);
	Light.add(990, 440, 300, "#8fd6ff", 0.4);
	Light.end();
	campScene(232, 452);
	// слизень-зевака справа
	{
		const hop = (t * 0.8) % 1,
			z = hop < 0.5 ? Math.sin((hop / 0.5) * Math.PI) * 16 : 0,
			x = 960 + Math.sin(t * 0.4) * 50;
		ctx.fillStyle = "rgba(10,8,20,.4)";
		ctx.beginPath();
		ctx.ellipse(x, 486, 18 - z * 0.3, 6, 0, 0, TAU);
		ctx.fill();
		fr(IMG.mobs, aFrame(ATL.mobs.slime, hop < 0.5 ? "walk" : "idle", hop * 2, hop < 0.5 ? undefined : t * 2), x, 486 - z, Math.cos(t * 0.4) > 0 ? -1 : 1, AP, z > 1 ? 1.1 : 1);
		fr(IMG.mobs, aFrame(ATL.mobs.red, "idle", 0, t * 2 + 1), 1070, 500, 1, AP, 1 + 0.03 * Math.sin(t * 3));
	}
	Parts.draw(2);
	vignette(1);
	logo(84);
	const bs = [
		["Продолжить", () => (SAVED ? loadGame() || (delSave(), toast("Сохранение повреждено")) : toast("Сохранения пока нет")), "#2e7d32", !SAVED],
		[
			"Новая игра",
			() => {
				newGame();
				G.choices = HEROES.slice()
					.sort(() => Rand.next() - 0.5)
					.slice(0, 3);
				PK = -1;
				State.go("pick");
			},
			"#8e24aa",
		],
		["Боевая арена", arenaStart, "#8e24aa"],
		["Коллекция", () => { CODEX_TEST = null; pop = null; State.go("codex"); }, "#8e24aa"],
		[
			"Настройки",
			() => {
				delAsk = false;
				SRET = "menu";
				State.go("settings");
			},
			"#8e24aa",
		],
		["Выход", doExit, "#c62828"],
	];
	bs.forEach(([q, f, c, d], i) => btn(479, 214 + i * 50, 260, 46, q, f, c, { dis: d, pulse: i === 0 && !d, sz: 21 }));
	if (CFG.best || CFG.arenaBest) txo((CFG.best ? "Пройдено миров: " + CFG.best + "   " : "") + (CFG.arenaBest ? "Рекорд арены: " + CFG.arenaBest + " волн" : ""), 609, 514, 13, "#e8e2f4", "center");
}
// Просмотр изображений в коллекции: только UI, не изменяет бой или сохранения.
let CODEX_TEST = null;
const CODEX_ACTIONS = [
	["idle", "Ожидание"], ["walk", "Ходьба"], ["run", "Бег"],
	["atk", "Атака"], ["atk2", "Атака 2"], ["hurt", "Ранение"],
	["dead", "Поражение"], ["cast", "Способность"], ["ult", "Ульта"],
	["win", "Победа"], ["jump", "Прыжок"], ["dodge", "Уклонение"],
];
function codexTestOpen(hero) {
	CODEX_TEST = { key: hero.k, mode: "idle", play: true, time: 0, start: t, speed: 1, face: 1, smooth: true, unit: {} };
	pop = null;
}
function codexElapsed(q) { return q.time + (q.play ? Math.max(0, t - q.start) * q.speed : 0); }
function codexFreeze(q) { q.time = codexElapsed(q); q.start = t; }
function codexAction(q, mode) { q.mode = mode; q.time = 0; q.start = t; q.unit = {}; }
function codexFrameSet(A, mode) {
	const direct = Array.isArray(A[mode]) && A[mode].length ? A[mode] : null;
	return { frames: direct || (Array.isArray(A.idle) ? A.idle : []), fallback: !direct };
}
function codexFps(hero, mode) {
	if (mode === "walk" || mode === "run") return hero.k === "frost" ? 3.2 + hero.spd * 0.35 : 5 + hero.spd * 0.7;
	return mode === "idle" ? 2.3 : mode === "win" ? 3.2 : 5;
}
function codexUniqueFrames(frames) { return new Set(frames.map((f) => f.slice(0, 4).join(","))).size; }
function codexHasSharedFrames(frames, other) {
	if (!Array.isArray(other) || !frames.length) return false;
	const keys = new Set(other.map((f) => f.slice(0, 4).join(",")));
	return frames.every((f) => keys.has(f.slice(0, 4).join(",")));
}
function codexSharedLabel(A, mode, frames) {
	const alternatives = mode === "atk2" ? [["atk", "атаки"]] : mode === "run" ? [["walk", "ходьбы"]] : mode === "ult" ? [["cast", "способности"], ["atk", "атаки"], ["idle", "ожидания"]] : mode === "jump" ? [["walk", "ходьбы"], ["idle", "ожидания"]] : mode === "dodge" ? [["idle", "ожидания"], ["walk", "ходьбы"]] : mode === "cast" ? [["atk", "атаки"], ["idle", "ожидания"]] : [];
	const match = alternatives.find(([key]) => codexHasSharedFrames(frames, A[key]));
	return match ? "Используются кадры " + match[1] : "";
}
function dCodexTest() {
	const q = CODEX_TEST, hero = HEROES.find((h) => h.k === q.key);
	if (!hero) { CODEX_TEST = null; return; }
	const [A, img] = uSet({ k: hero.k, team: 0 }, 0), selection = codexFrameSet(A, q.mode), frames = selection.frames;
	menuBG(false);
	ctx.fillStyle = "rgba(10,8,18,.72)"; ctx.fillRect(0, 0, W, H);
	title("Просмотр анимаций", 40);
	panel(25, 80, 550, 373); panel(600, 80, 590, 373);
	txo(hero.n, 300, 108, 22, "#fff3c0", "center");
	tx("Показываются реальные кадры спрайта", 300, 133, 13, "#d1c9df", "center");
	ctx.fillStyle = "rgba(11,8,20,.65)"; ctx.fillRect(52, 155, 496, 226);
	ctx.strokeStyle = "rgba(255,255,255,.14)"; ctx.lineWidth = 2;
	ctx.beginPath(); ctx.moveTo(75, 336); ctx.lineTo(525, 336); ctx.stroke();
	ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.beginPath(); ctx.ellipse(300, 337, 56, 9, 0, 0, TAU); ctx.fill();
	const elapsed = codexElapsed(q), fps = codexFps(hero, q.mode), count = frames.length;
	const index = count ? Math.floor(elapsed * fps + 1e-7) % count : 0, frame = frames[index];
	if (frame && img) {
		ctx.save(); ctx.beginPath(); ctx.rect(55, 158, 490, 221); ctx.clip();
		const [previous, mix] = q.smooth && q.play && img === IMG.heroes3 ? spriteTransition(q.unit, img, frame, t) : [null, 1];
		const scale = AP * (hero.sc || 1) * 2.2;
		if (previous) { ctx.globalAlpha = 1; fr(img, previous, 300, 336, q.face, scale); }
		ctx.globalAlpha = mix; fr(img, frame, 300, 336, q.face, scale); ctx.globalAlpha = 1;
		ctx.restore();
	}
	const unique = codexUniqueFrames(frames), modeLabel = (CODEX_ACTIONS.find(([k]) => k === q.mode) || ["", ""])[1];
	txo(modeLabel + " · кадр " + (count ? index + 1 : 0) + "/" + count, 300, 400, 15, "#fff", "center");
	tx("Разных изображений: " + unique + (selection.fallback ? " · замена на ожидание" : ""), 300, 422, 13, "#d1c9df", "center");
	CODEX_ACTIONS.forEach(([key, label], i) => {
		const x = 620 + (i % 3) * 182, y = 104 + Math.floor(i / 3) * 49;
		btn(x, y, 170, 39, label, () => codexAction(q, key), q.mode === key ? "#2e7d32" : "#8e24aa", { sz: 14 });
	});
	const shared = codexSharedLabel(A, q.mode, frames);
	tx(shared || (unique < 2 ? "Пока только одна поза" : "Переходы можно включать и выключать"), 630, 319, 13, "#ffd99a");
	btn(620, 339, 170, 40, q.play ? "Пауза" : "Играть", () => { codexFreeze(q); q.play = !q.play; q.unit = {}; }, "#8e24aa", { sz: 15 });
	btn(801, 339, 170, 40, "След. кадр", () => { codexFreeze(q); q.play = false; q.time = (Math.floor(q.time * fps + 1e-7) + 1) / fps; q.unit = {}; }, "#8e24aa", { sz: 14 });
	btn(982, 339, 170, 40, "Скорость ×" + q.speed, () => { codexFreeze(q); q.speed = q.speed === 0.5 ? 1 : q.speed === 1 ? 2 : 0.5; }, "#8e24aa", { sz: 13 });
	btn(620, 392, 230, 40, q.smooth ? "Сглаживание: вкл" : "Сглаживание: выкл", () => { q.smooth = !q.smooth; q.unit = {}; }, "#8e24aa", { sz: 13 });
	btn(862, 392, 290, 40, q.face === 1 ? "Повернуть влево" : "Повернуть вправо", () => { q.face *= -1; }, "#8e24aa", { sz: 14 });
	btn(25, 484, 190, 42, "К коллекции", () => { CODEX_TEST = null; pop = null; }, "#8e24aa", { sz: 15 });
	tx("Просмотр не запускает бой и не меняет сохранение", 605, 507, 13, "#d1c9df", "center");
}

function dCodex() {
	if (CODEX_TEST) return dCodexTest();
	menuBG(false);
	ctx.fillStyle = "rgba(10,8,18,.6)";
	ctx.fillRect(0, 0, W, H);
	title("Коллекция бойцов", 40);
	txo("Все герои отряда · редкость влияет на здоровье и атаку · нажми на карточку для подробностей", 609, 62, 13, "#e8e2f4", "center", INK, false);
	const cw = 164, chh = 204, gx = 12, gy = 70;
	HEROES.forEach((h, i) => {
		const col = i % 7, row = (i / 7) | 0;
		const x = gx + col * (cw + 8), y = gy + row * (chh + 6);
		const K = KIT[h.k], cx = x + cw / 2, rar = h.rar || 0;
		ctx.fillStyle = "#1c1626";
		ctx.fillRect(x + 4, y + 4, cw - 8, chh - 8);
		ctx.globalAlpha = 0.14;
		ctx.fillStyle = EL[K.el].c;
		ctx.fillRect(x + 4, y + 4, cw - 8, 84);
		ctx.globalAlpha = 1;
		glow(cx, y + 48, 44, EL[K.el].c, 0.3);
		ctx.fillStyle = "rgba(10,8,20,.4)";
		ctx.beginPath();
		ctx.ellipse(cx, y + 70, 26, 7, 0, 0, TAU);
		ctx.fill();
		const tu = { k: h.k, team: 0, ph: i * 1.3, sc: h.sc || 1 };
		uIdle(tu, cx, y + 70, AP * (h.sc || 1), 1, 0, "idle");
		txo(h.n, cx, y + 84, 13, "#fff", "center");
		txo(K.role + " · " + RAR[rar].n, cx, y + 100, 11, RAR[rar].c, "center");
		[["hp", h.hp], ["atk", h.atk], ["arm", h.arm], ["spd", h.spd]].forEach((q, j) => {
			const sx = x + 14 + (j % 2) * 76, sy = y + 118 + ((j / 2) | 0) * 16;
			gly(q[0], sx + 6, sy, 12, j === 0 ? "#ff6a6a" : "#ffd27a", "#17121f");
			tx("" + q[1], sx + 18, sy + 1, 12, "#fff");
		});
		txo(K.ab.n, x + 10, y + 154, 11, EL[K.el].c, "left");
		rframe(rar, x, y, cw, chh);
		rfx(rar, x, y, cw, chh, i * 0.7);
		area(x, y, cw, chh, () => { pop = { u: mkHero(h, rar), mine: true }; sfx("pick"); });
	});
	btn(20, 484, 130, 42, "Назад", toMenu, "#8e24aa", { sz: 16 });
}
function dPick() {
	menuBG(false);
	ctx.fillStyle = "rgba(10,8,18,.55)";
	ctx.fillRect(0, 0, W, H);
	title("Выбери первого бойца", 42);
	G.choices.forEach((h, i) => {
		const cw = 236,
			chh = 330,
			x = 609 + (i - 1) * 262 - cw / 2,
			sl = PK === i,
			y = 88 - (sl ? 8 : 0),
			K = KIT[h.k],
			cx = x + cw / 2,
			col = EL[K.el].c;
		ctx.fillStyle = sl ? "#2e2440" : "#1c1626";
		ctx.fillRect(x + 6, y + 6, cw - 12, chh - 12);
		ctx.globalAlpha = 0.14;
		ctx.fillStyle = col;
		ctx.fillRect(x + 6, y + 6, cw - 12, 130);
		ctx.globalAlpha = 1;
		glow(cx, y + 90, 70, col, sl ? 0.5 : 0.25);
		ctx.fillStyle = "rgba(10,8,20,.4)";
		ctx.beginPath();
		ctx.ellipse(cx, y + 142, 34, 9, 0, 0, TAU);
		ctx.fill();
		{ const [A2, im2] = uSet({ k: h.k, team: 0 }, 0); ctx.save(); ctx.beginPath(); ctx.rect(x + 6, y + 6, cw - 12, chh - 12); ctx.clip(); fr(im2, aFrame(A2, "idle", 0, t * 2.2 + i), cx, y + 142, 1, 4 * (h.sc || 1), 1 + 0.02 * Math.sin(t * 3 + i)); ctx.restore(); }
		txo(h.n, cx, y + 164, 19, "#fff", "center");
		txo(K.role, cx, y + 186, 14, col, "center");
		[
			["hp", h.hp],
			["atk", h.atk],
			["arm", h.arm],
			["spd", h.spd],
		].forEach((q, j) => {
			const sx = x + 22 + (j % 2) * 100,
				sy = y + 210 + ((j / 2) | 0) * 24;
			gly(q[0], sx + 8, sy, 14, j === 0 ? "#ff6a6a" : "#ffd27a", "#17121f");
			tx("" + q[1], sx + 22, sy + 1, 14, "#fff");
		});
		txo(K.ab.n, x + 18, y + 258, 13, col, "left");
		txo("Ульта: " + K.ult.n, x + 18, y + 282, 13, "#ffd27a", "left");
		tx(h.heal ? "Лечит союзников" : h.rng >= 140 ? "Дальний бой" : "Ближний бой", x + 18, y + 306, 12, "#b9b3c8");
		rframe(sl ? 4 : 0, x, y, cw, chh);
		area(x, 88, cw, chh, () => {
			if (PK === i) startRun();
			else {
				PK = i;
				sfx("pick");
				burst(cx, y + 100, 12, { c: [col, "#fff"], sp: 160, s: 4, life: 0.5, l: 2 });
			}
		});
	});
	Parts.draw(2);
	if (PK >= 0) {
		const K = KIT[G.choices[PK].k];
		txw(K.ab.d + " " + K.ult.d, 609, 440, 760, 16, 13, "#e8e2f4", "center");
	} else txo("Остальные бойцы присоединятся по пути — ищи значок племени на карте", 609, 448, 14, "#e8e2f4", "center", INK, false);
	btn(499, 478, 220, 50, "В поход!", startRun, "#2e7d32", { dis: PK < 0, pulse: PK >= 0, sz: 22 });
	btn(20, 484, 130, 42, "Назад", toMenu, "#8e24aa", { sz: 16 });
}
function startRun() {
	if (PK < 0) return;
	G.slots[0] = recruit(G.choices[PK], 0);
	State.go("map");
	sfx("start");
	autosave();
}
// ---------- настройки ----------
function _mxh(s) {
	let h = 0x811c9dc5;
	const t2 = "mxdev2026" + s;
	for (let i = 0; i < t2.length; i++) { h ^= t2.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
	return h.toString(16).padStart(8, "0");
}
function devGate() {
	if (document.getElementById("mx-dev-ov")) return;
	const ov = document.createElement("div");
	ov.id = "mx-dev-ov";
	ov.style.cssText = "position:fixed;inset:0;z-index:100000;background:rgba(5,3,8,.75);display:flex;align-items:center;justify-content:center";
	ov.innerHTML = '<div style="background:#1c1626;border:1px solid #8e24aa;border-radius:14px;padding:22px 24px;color:#fff;font:14px system-ui;text-align:center;min-width:280px"><div style="font-weight:800;margin-bottom:12px">Режим разработчика</div><input id="mx-dev-in" type="password" inputmode="numeric" autocomplete="off" placeholder="Пароль" style="width:100%;padding:10px;border-radius:8px;border:1px solid #555;background:#0f0b16;color:#fff;text-align:center;font-size:16px"><div id="mx-dev-err" style="color:#ff6a6a;min-height:18px;margin-top:8px;font-size:12px"></div><div style="display:flex;gap:8px;margin-top:10px"><button id="mx-dev-ok" style="flex:1;padding:10px;border-radius:8px;border:0;background:#8e24aa;color:#fff;font-weight:800;cursor:pointer">Войти</button><button id="mx-dev-no" style="flex:1;padding:10px;border-radius:8px;border:1px solid #555;background:#2a2238;color:#fff;cursor:pointer">Отмена</button></div></div>';
	document.body.appendChild(ov);
	const inp = ov.querySelector("#mx-dev-in");
	inp.focus();
	const close = () => ov.remove();
	ov.querySelector("#mx-dev-no").onclick = (e) => { e.stopPropagation(); close(); };
	ov.addEventListener("pointerdown", (e) => e.stopPropagation());
	ov.addEventListener("click", (e) => e.stopPropagation());
	const ok = () => {
		if (_mxh(inp.value) === "4d2208a5") {
			window.__mxStorage.setItem("mx_dev", "1");
			const b = document.getElementById("mx-b");
			if (b) b.style.display = "block";
			if (window.mxUnlock) window.mxUnlock();
			close();
			toast("Режим разработчика включён");
		} else {
			ov.querySelector("#mx-dev-err").textContent = "Неверный пароль";
			inp.value = "";
			inp.focus();
		}
	};
	ov.querySelector("#mx-dev-ok").onclick = (e) => { e.stopPropagation(); ok(); };
	inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === "Enter") ok(); if (e.key === "Escape") close(); };
}
function dSet() {
	menuBG(false);
	ctx.fillStyle = "rgba(10,8,18,.6)";
	ctx.fillRect(0, 0, W, H);
	panel(209, 74, 800, 392);
	title("Настройки", 76);
	const rows = [
		[
			"Музыка",
			Music.on ? "Вкл" : "Выкл",
			() => {
				Music.toggle();
				saveCfg();
			},
			Music.on,
		],
		[
			"Громкость музыки",
			Math.round(Music.vol * 100) + "%",
			() => {
				const l = [1, 0.6, 0.3];
				Music.setVol(l[(l.indexOf(Music.vol) + 1) % 3]);
				saveCfg();
			},
		],
		[
			"Громкость звуков",
			Math.round((CFG.sfx === undefined ? 1 : CFG.sfx) * 100) + "%",
			() => {
				const l = [1, 0.6, 0.3, 0];
				CFG.sfx = l[(l.indexOf(CFG.sfx === undefined ? 1 : CFG.sfx) + 1) % 4];
				Music.sfxv = CFG.sfx;
				saveCfg();
				sfx("coin");
			},
			CFG.sfx !== 0,
		],
		[
			"Графика",
			QL.auto ? "Авто (" + ["низк.", "средн.", "выс."][QL.lv] + ")" : ["Низкая", "Средняя", "Высокая"][QL.lv],
			() => {
				const l = ["auto", 2, 1, 0],
					c = QL.auto ? "auto" : QL.lv;
				setQ(l[(l.indexOf(c) + 1) % 4]);
				hiDpi();
				saveCfg();
			},
		],
		[
			"Тряска экрана",
			CFG.shake === false ? "Выкл" : "Вкл",
			() => {
				CFG.shake = CFG.shake === false;
				saveCfg();
				shake(0.3);
			},
			CFG.shake !== false,
		],
		[
			"Ульты героев",
			CFG.autoUlt === false ? "Вручную" : "Авто",
			() => {
				CFG.autoUlt = CFG.autoUlt === false;
				saveCfg();
			},
			CFG.autoUlt !== false,
		],
		[
			"Счётчик FPS",
			CFG.fps ? "Вкл" : "Выкл",
			() => {
				CFG.fps = !CFG.fps;
				saveCfg();
			},
			CFG.fps,
		],
		[
			"Сохранение",
			SAVED ? (delAsk ? "Точно удалить?" : "Удалить") : "Нет",
			() => {
				if (!SAVED) return;
				if (delAsk) {
					delSave();
					delAsk = false;
					toast("Сохранение удалено");
				} else delAsk = true;
			},
			false,
			SAVED ? "#c62828" : "#555",
		],
	];
	rows.forEach(([lb, val, f, on, col], i) => {
		const x = 233 + (i % 2) * 390,
			y = 128 + ((i / 2) | 0) * 66;
		chip(x, y, 368, 54, "rgba(20,16,28,.6)");
		tx(lb, x + 16, y + 28, 16, "#fff");
		btn(x + 196, y + 7, 164, 40, val, f, col || (on === undefined || on ? "#2e7d32" : "#555"), { sz: 15 });
	});
	if (CFG.autoUlt === false) tx("Ручные ульты: нажми на портрет бойца, когда полоска энергии полная", 609, 400, 12, "#b9b3c8", "center");
	btn(233, 414, 268, 44, window.__mxStorage.getItem("mx_dev") === "1" ? "Разработчик: включён" : "Режим разработчика", () => devGate(), "#8e24aa", { sz: 15 });
	btn(529, 414, 160, 44, "Назад", () => {
		delAsk = false;
		S = SRET;
	});
}
// ---------- мир пройден ----------
function dWorld() {
	const nw = WORLDS[G.w + 1],
		w = WORLDS[G.w],
		k = Math.min(1, (t - WT0) * 1.5);
	stageBG(G.w + 1, 0.35);
	MAPA.w = nw;
	Parts.draw(2);
	vignette(1);
	title("Мир пройден: " + w.n, 46);
	panel(289, 96, 640, 330);
	// окно в следующий мир
	const im = IMG[nw.stage];
	ctx.fillStyle = INK;
	ctx.fillRect(309, 112, 304, 200);
	ctx.drawImage(im, 150, 40, 300, 196, 311, 114, 300, 196);
	rframe(3, 305, 108, 312, 208);
	txo("Дальше — мир " + (G.w + 2), 780, 128, 15, "#d9d4e8", "center");
	txo(nw.n, 780, 158, 26, nw.ui, "center");
	txw(nw.sub, 780, 190, 280, 17, 14, "#e8e2f4", "center");
	// кто там живёт
	const us2 = ["a", "m", "b"].map((s, i) => ({ ...foeDef(G.w + 1, s), team: 1, ph: i * 1.7 }));
	us2.forEach((u, i) => {
		const x = 700 + i * 80,
			y = 290;
		ctx.fillStyle = "rgba(10,8,20,.4)";
		ctx.beginPath();
		ctx.ellipse(x, y + 1, 18, 6, 0, 0, TAU);
		ctx.fill();
		uIdle(u, x, y, AP * (u.sc || 1), -1, G.w + 1);
	});
	txw("Враги сильнее примерно вдвое, награды — в полтора раза больше", 609, 326, 380, 16, 12, "#b9b3c8", "center");
	const st = G.st;
	tx("Боёв выиграно: " + st.fights + "   ·   Врагов повержено: " + st.kills + "   ·   Урон: " + fmt(st.dmg), 609, 348, 13, "#e8e2f4", "center");
	tx("Отряд полностью вылечен. Лавка открыта в начале пути.", 609, 368, 13, "#aaff9a", "center");
	if (k >= 1) btn(499, 384, 220, 50, "В путь!", nextWorld, "#2e7d32", { pulse: 1, sz: 22 });
	hud();
}
// ---------- итог похода ----------
function dEnd() {
	const wn = State.is("win"),
		st = G.st;
	if (BGA) ctx.drawImage(BGA.floor, 0, 0, W, H);
	else stageBG(G.w || 0);
	ctx.fillStyle = wn ? "rgba(30,18,4,.55)" : "rgba(20,4,8,.72)";
	ctx.fillRect(0, 0, W, H);
	if (wn) {
		rays(609, 150, 4, 700);
		if (Rand.next() < 0.25) {
			const x = rr(150, 1070),
				y = rr(60, 300),
				c = pick(["#ffd23c", "#ff8af0", "#8fd6ff", "#6dff7a", "#ff6a5a"]);
			burst(x, y, 22, { c: [c, "#ffffff"], sp: 240, s: 4, life: 0.9, l: 2, g: 160 });
		}
	}
	Parts.draw(2);
	vignette(1);
	const s = Math.min(1, (t - ENDT) * 3);
	txo(wn ? "ПОБЕДА!" : "ПОРАЖЕНИЕ", 609, 118, Math.round(72 * ez.back(s)), wn ? "#ffe27a" : "#ff6a5a", "center", wn ? "#6a2a08" : "#2a0408");
	const worlds = WORLDS.slice(0, (G.w || 0) + (wn ? 1 : 0)).map((w) => w.n);
	txo(G.arena ? "Арена: пройдено волн — " + Math.max(0, G.wave - 1) + (CFG.arenaBest ? "   (рекорд: " + CFG.arenaBest + ")" : "") : wn ? "Монстры пробуждены. Пройдены миры: " + worlds.join(", ") : "Отряд пал в мире «" + WORLDS[G.w || 0].n + "»" + (worlds.length ? ". Пройдено: " + worlds.join(", ") : ""), 609, 182, 17, "#fff", "center");
	panel(359, 214, 500, 150);
	[
		["Боёв выиграно", st.fights],
		["Врагов повержено", st.kills],
		["Нанесено урона", fmt(st.dmg)],
		["Критических ударов", st.crits],
		["Реликвий собрано", G.rel.length],
	].forEach((q, i) => {
		tx(q[0], 389, 236 + i * 27, 15, "#d9d4e8");
		tx("" + q[1], 829, 236 + i * 27, 18, "#fff3a0", "right", true);
	});
	// отряд
	const us2 = G.slots.filter(Boolean);
	us2.forEach((u, i) => {
		const x = 609 + (i - (us2.length - 1) / 2) * 58;
		uIdle(u, x, 448, AP, 1, G.w || 0, wn ? "win" : "idle");
	});
	btn(389, 468, 210, 50, G.arena ? "Ещё раз" : "Новый поход", () => {
		if (G.arena) arenaStart();
		else {
			newGame();
			G.choices = HEROES.slice()
				.sort(() => Rand.next() - 0.5)
				.slice(0, 3);
			PK = -1;
			State.go("pick");
		}
	}, "#2e7d32", { sz: 20 });
	btn(619, 468, 210, 50, "В меню", toMenu, "#8e24aa", { sz: 20 });
}
let ENDT = 0;
// ---------- кадр ----------
function pauseMenu() {
	ctx.fillStyle = "rgba(8,6,14,.74)";
	ctx.fillRect(0, 0, W, H);
	area(0, 0, W, H, () => {});
	const camp = G && !G.arena && !State.is("pick") && !State.is("win") && !State.is("lose"),
		items = [
			["Вернуться в игру", () => (paused = false), "#2e7d32"],
			[
				"Настройки",
				() => {
					paused = false;
					delAsk = false;
					SRET = S;
					State.go("settings");
				},
				"#8e24aa",
			],
		];
	if (camp)
		items.push([
			"Сохранить и выйти",
			() => {
				if (saveGame()) toast("Игра сохранена");
				toMenu();
			},
			"#8e24aa",
		]);
	else items.push([G && G.arena ? "Покинуть арену" : "В меню", toMenu, "#c62828"]);
	const h = 96 + items.length * 58;
	panel(459, 270 - h / 2, 300, h);
	title("Пауза", 270 - h / 2 + 8);
	items.forEach(([q, f, c], i) => btn(479, 270 - h / 2 + 62 + i * 58, 260, 46, q, f, c, { sz: 19 }));
	area(529, 270 - h / 2 - 28, 160, 64, eggTap);
}
function draw() {
	ctx.setTransform(R, 0, 0, R, 0, 0);
	ctx.imageSmoothingEnabled = false;
	ctx.globalAlpha = 1;
	ctx.globalCompositeOperation = "source-over";
	ctx.fillStyle = "#0c0a12";
	ctx.fillRect(0, 0, W, H);
	hits = [];
	if (!READY) {
		txo("Пробуждение монстров", 609, 230, 34, "#ffd23c", "center");
		pbar(409, 280, 400, 12, LOADP, "#ffd23c");
		tx("Загрузка…", 609, 316, 14, "#b9b3c8", "center");
		return;
	}
	if (State.cur !== lastS) {
		if (SCENE[S] !== SCENE[lastS]) {
			Parts.clear();
			TRT = 0.42;
			CAM.z = 1;
		}
		if (State.is("win") || State.is("lose")) ENDT = t;
		if (!State.is("prep") && !State.is("fight") && !State.is("shop") && !State.is("map")) pop = null;
		if (lastS === "fight" || lastS === "prep") pop = null;
		TIPN = TIPR = null;
		lastS = S;
	}
	ctx.save();
	if (SK > 0) ctx.translate(Math.round((Rand.next() - 0.5) * SK * 20) * 2, Math.round((Rand.next() - 0.5) * SK * 20) * 2);
	if (State.is("menu")) dMenu();
	else if (State.is("pick")) dPick();
	else if (State.is("map")) dMap();
	else if (State.is("prep") || State.is("fight")) dFight();
	else if (State.is("msg")) dMsg();
	else if (State.is("shop")) dShop();
	else if (State.is("settings")) dSet();
	else if (State.is("world")) dWorld();
	else if (State.is("codex")) dCodex();
	else dEnd();
	if (State.is("map") || State.is("prep") || State.is("fight") || State.is("shop") || State.is("codex")) dPop();
	if (!State.is("menu") && !State.is("win") && !State.is("lose") && !State.is("settings")) ibtn("pause", 1142, 6, () => (paused = true));
	if (!State.is("settings")) ibtn("note", State.is("menu") || State.is("win") || State.is("lose") ? 1142 : 1068, 6, () => (Music.toggle(), saveCfg()), { off: !Music.on });
	Fly.draw();
	if (FLASH) {
		const k = (t - FLASH.t0) / FLASH.d;
		if (k >= 1) FLASH = null;
		else {
			ctx.globalAlpha = 0.5 * (1 - k);
			ctx.fillStyle = FLASH.c;
			ctx.fillRect(0, 0, W, H);
			ctx.globalAlpha = 1;
		}
	}
	if (paused) pauseMenu();
	drawToast();
	ctx.restore();
	drawTrans();
	if (CFG.fps) fpsDraw();
}


