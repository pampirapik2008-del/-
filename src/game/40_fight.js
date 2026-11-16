// ===== 40_fight.js =====
// ===== БОЙ: расстановка, движение с обходом препятствий, удары, криты, статусы, способности, боссы =====
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const liv = (l) => l.filter((e) => e.hp > 0 && !e.dead);
const wxm = (k, d = 1) => {
	const q = F && F.A && WX[F.A.wx];
	return q && q[k] !== undefined ? q[k] : d;
};
function resetU(u) {
	u.cd = 0.3 + Rand.next() * 0.3;
	u.hc = 2;
	u.atkT = 0;
	u.atkD = 0.3;
	u.hitT = 0;
	u.mv = 0;
	u.st = {};
	u.sh = 0;
	u.shT = 0;
	u.en = 0;
	u.acd = 2.5 + Rand.next() * 2.5;
	u.an = null;
	u.z = 0;
	u.inv = 0;
	u.kx = 0;
	u.ky = 0;
	u.sw = null;
	u.hpl = u.hp / u.max;
	u.dead = 0;
	u.vx = 0;
	u.vy = 0;
	u.hop = Rand.next();
	u.tau = null;
	u.jump = null;
	u.dash = null;
	u.ulc = null;
	u.nf = 0;
	u.spw = 0;
	u.ultQ = 0;
	if (!u.rad) u.rad = 16;
}
function mkU(d, team, x, y, m = 1) {
	const u = { ...d, max: Math.round(d.hp * m), hp: Math.round(d.hp * m), atk: Math.round(d.atk * m), team, x, y, ph: Rand.next() * 6, face: team ? -1 : 1, ax: 0, ay: 0 };
	if (u.r === undefined) u.r = 0;
	resetU(u);
	return u;
}
// новый герой с редкостью (редкость множит здоровье и атаку)
function mkHero(h, r = 0) {
	const u = mkU(h, 0, 0, 0, RAR[r].um);
	u.r = r;
	return u;
}
// ближайшая свободная клетка поля
function placeFree(A, x, y) {
	x = clamp(x, FLD.x0, FLD.x1);
	y = clamp(y, A.y0, FLD.y1);
	if (!A.grid[cellOf(A, x, y)]) return [x, y];
	for (let r = 1; r < 14; r++)
		for (let a = 0; a < 12; a++) {
			const px = x + Math.cos((a / 12) * TAU) * r * CELL,
				py = y + Math.sin((a / 12) * TAU) * r * CELL * 0.7;
			if (px > FLD.x0 && px < FLD.x1 && py > A.y0 && py < FLD.y1 && !A.grid[cellOf(A, px, py)]) return [px, py];
		}
	return [x, y];
}
function fight(kind) {
	const d = G.depth,
		w = G.w || 0,
		m = 0.75 + d * 0.12;
	let l;
	if (kind === "boss") l = ["boss", "m"];
	else if (kind === "arena") l = ["b", "b", "b"];
	else if (kind === "swamp") l = ["m", "m"];
	else
		l = Array.from({ length: Math.min(1 + Math.floor(d / 3), 5) }, () => {
			const r = Rand.next();
			return d > 8 && r < 0.3 ? "b" : d > 4 && r < 0.5 ? "m" : "a";
		});
	// сид арены привязан к узлу карты: после загрузки сохранения арена та же
	const seed = G.arena ? (Rand.next() * 2e9) | 0 : ((SD * 31 + G.cur * 977 + d * 131 + w * 7919) >>> 0) % 2147483647 || 1,
		A = mkArena(seed, w, kind),
		y0 = A.y0,
		y1 = FLD.y1;
	F = { kind, A, w, en: [], pl: [], timer: kind === "boss" ? 200 : 110, time: 0, fx: [], nums: [], proj: [], tele: [], dd: [], fl: [], pt: [], rg: [], lock: 0, out: null, rb: relBonus(), phx: 0, avg: 0, flux: null, slowT: 0, slowS: 1, st: { dmg: 0, taken: 0, kills: 0, crits: 0 }, t0: t, m };
	// строй врагов: до трёх колонок, ряды поровну, чтобы спрайты не наезжали друг на друга
	const cols = Math.min(3, l.length),
		per = Math.ceil(l.length / cols);
	l.forEach((k, i) => {
		const def = foeDef(w, k),
			boss = k === "boss";
		let x = boss ? 900 : 792 + (i % cols) * 104 + (i < 3 ? 0 : 12),
			y = boss ? (y0 + y1) / 2 + 10 : y0 + 46 + (((i / cols) | 0) + 0.5) * (y1 - y0 - 96) / per;
		if (kind === "boss" && !boss) (x = 770), (y = y1 - 30);
		[x, y] = placeFree(A, x, y);
		const u = mkU(def, 1, x, y, boss ? 1 : m);
		u.born = t + 0.3 + i * 0.14; // появление по очереди
		if (boss) {
			const B = WORLDS[w].boss;
			u.bph = 0;
			u.gates = B.p3 ? [0.66, 0.33] : [0.5];
			u.gate = u.max * u.gates[0];
			u.bt = 3.5;
			u.pi = 0;
			u.sc = 1;
		}
		F.en.push(u);
	});
	G.slots.forEach((u) => {
		if (u) {
			u.placed = false;
			if (u.hp <= 0) u.hp = Math.ceil(u.max * 0.25);
			resetU(u);
		}
	});
	sel = G.slots.findIndex((q) => q);
	pop = null;
	S = "prep";
	// бойцы сразу стоят на поле: игрок может расставить их иначе или нажать «В бой!»
	F.pl = G.slots.filter((u) => u);
	autoPlace();
	sfx(kind === "boss" ? "roar" : "spawn");
}
function startFight() {
	F.pl = G.slots.filter((u) => u && u.placed);
	if (!F.pl.length) {
		toast("Сначала расставь бойцов на поле", "ic_x");
		sfx("err");
		return;
	}
	sel = -1;
	pop = null;
	S = "fight";
	Seq.clock = F.time; // задержки выстрелов и приёмов — по времени симуляции
	F.rb = relBonus();
	F.pl.forEach((u) => {
		u.face = 1;
		if (F.rb.ward) {
			u.sh = Math.round(u.max * F.rb.ward);
			u.shT = 999;
		}
	});
	F.t0 = t;
	if (F.kind === "boss") {
		const b = F.en.find((e) => e.boss);
		F.lock = 2.4;
		F.fx.push({ k: "banner", s: b.n, s2: "Босс · " + WORLDS[F.w].n, t: 0, d: 2.4, c: WORLDS[F.w].ui });
		anim(b, "cast", 1.6);
		Seq.at(0.5, () => {
			sfx("roar");
			shake(0.5);
			ring(b.x, b.y, 320, WORLDS[F.w].ui, 0.7, 8);
		});
	} else F.fx.push({ k: "go", t: 0, d: 0.9 });
	sfx("start");
}
function anim(u, n, d, lock = true) {
	u.an = { n, t: 0, d, lock };
}
function slowmo(s, d) {
	F.slowS = s;
	F.slowT = d;
}
// ---------- характеристики с учётом статусов, погоды и покрытий ----------
function eSpd(u) {
	let v = u.spd * wxm("spd");
	if (u.st.chill) v *= 0.65;
	if (u.st.rage) v *= 1.25;
	const P = surfAt(F.A, u.x, u.y);
	if (P) v *= P.slow || P.slip || 1;
	if (F.flux && F.flux.k === "haste") v *= 1.25;
	return v;
}
function eAspd(u) {
	let v = u.aspd * wxm("as");
	if (u.st.chill) v *= 0.72;
	if (u.st.rage) v *= 1.3;
	return v;
}
function eAtk(u) {
	let v = u.atk;
	if (u.st.curse) v *= 0.85;
	if (u.st.rage) v *= 1.2;
	if (!u.team && F.avg) v *= 1 + F.avg;
	if (F.flux && F.flux.k === "might") v *= 1.25;
	return v;
}
const eRng = (u) => u.rng * wxm("rng");
function addSt(u, k, tm, v = 0) {
	if (!u || u.hp <= 0 || u.inv > 0) return;
	if (k === "rnd") k = pick(["burn", "chill", "poison", "shock", "curse"]);
	if (u.boss && (k === "stun" || k === "freeze" || k === "chill")) tm *= 0.4;
	if (k === "shock") {
		u.st.stun = { t: Math.max((u.st.stun && u.st.stun.t) || 0, u.boss ? 0.15 : 0.35) };
		tm = 2.5;
	}
	if (k === "poison") tm += wxm("psn", 0);
	if (k === "burn" && wxm("wet", 0)) tm *= 0.5;
	const o = u.st[k];
	if (o) {
		o.t = Math.max(o.t, tm);
		o.v = k === "poison" ? Math.min(o.v + v, v * 4) : Math.max(o.v || 0, v);
	} else u.st[k] = { t: tm, v, tk: 0 };
}
const Fx = {
	num(u, s, k, col) {
		if (F.nums.length > 44) F.nums.shift();
		// цифры раскладываем по шести «местам» вокруг головы, чтобы они не печатались друг поверх друга
		u.nf = (u.nf || 0) + 1;
		const slot = (F.nums.length + u.nf) % 6;
		F.nums.push({
			x: u.x + ((slot % 3) - 1) * 26 + rr(-7, 7),
			y: u.y - (u.rad > 30 ? 150 : 70) - ((slot / 3) | 0) * 18 - (u.z || 0) + rr(-4, 4),
			s: typeof s === "number" ? fmt(s) : s,
			k,
			c: col,
			t: 0,
			vx: rr(-16, 16),
		});
	},
	txt(x, y, s, c = "#fff", sz = 20) {
		F.nums.push({ x, y, s, k: "txt", c, t: 0, vx: 0, sz });
	},
	add(o) {
		o.t = 0;
		F.fx.push(o);
	},
};
function hitProps(x, y, r, pow = 1) {
	for (const o of F.A.obs) {
		if (o.dead || !o.hp) continue;
		if (Math.abs(o.x - x) < r + o.rx && Math.abs(o.y - y) < (r + o.rx) * 0.6) {
			o.hp -= pow;
			o.hitT = 0.25;
			if (o.hp <= 0) breakProp(F.A, o);
			else burst(o.x, o.y - 14, 4, { c: o.d.deb || ["#999"], sp: 110, s: 4, life: 0.4 });
		}
	}
}
function heal(tg, v, src) {
	if (!tg || tg.hp <= 0) return 0;
	v *= wxm("heal");
	if (tg.st.curse) v *= 0.5;
	v = Math.min(Math.round(v), tg.max - tg.hp);
	if (v <= 0) return 0;
	tg.hp += v;
	Fx.num(tg, "+" + fmt(v), "heal");
	burst(tg.x, tg.y - 30, 6, { c: ["#6dff7a", "#d6ffb0"], sp: 50, g: -120, life: 0.7, s: 4, rad: 24 });
	return v;
}
// единая точка урона: броня, крит, щит, фазы босса, вампиризм, срабатывания реликвий, эффекты
function hurt(src, tg, raw, o = {}) {
	if (!tg || tg.hp <= 0 || tg.dead) return 0;
	if (tg.inv > 0) {
		if (!o.dot && Rand.next() < 0.5) Fx.num(tg, "блок", "txt", "#fff3b0");
		return 0;
	}
	const el = o.el || (src && src.el) || "phys";
	let dm = o.pure ? raw : (raw * 100) / (100 + Math.max(0, tg.arm)),
		crit = false;
	if (src && !o.dot && !o.nocrit) {
		const cc = (src.team ? 0.05 : ((KIT[src.k] && KIT[src.k].crit) || 0.06) + F.rb.crit) + wxm("crit", 0);
		if (o.crit === 1 || Rand.next() < cc) {
			crit = true;
			dm *= 1.8 + (src.team ? 0 : F.rb.crd);
		}
	}
	if (tg.st.shock) dm *= 1.15;
	if (o.abil && src && !src.team) dm *= 1 + F.rb.abil;
	dm = Math.max(1, Math.round(dm));
	if (tg.sh > 0) {
		const a = Math.min(tg.sh, dm);
		tg.sh -= a;
		dm -= a;
		Fx.num(tg, fmt(a), "sh");
		if (dm <= 0) {
			tg.hitT = 0.1;
			burst(tg.x, tg.y - 30, 4, { c: "#8fd6ff", sp: 120, s: 4, life: 0.3 });
			return 0;
		}
	}
	if (tg.boss && tg.gate !== undefined && tg.hp - dm <= tg.gate) {
		dm = Math.max(1, Math.round(tg.hp - tg.gate));
		tg.hp = tg.gate;
		bossPhase(tg);
	} else tg.hp -= dm;
	tg.hitT = 0.16;
	if (!o.dot) tg.lastHit = src;
	if (src && !src.team) {
		F.st.dmg += dm;
		if (crit) F.st.crits++;
	} else F.st.taken += tg.team ? 0 : dm;
	const chg = wxm("chg");
	if (src && !o.dot && !o.proc) src.en = Math.min(100, (src.en || 0) + 8 * chg * (src.team ? 1 : 1 + F.rb.chg));
	if (!o.dot) tg.en = Math.min(100, (tg.en || 0) + 4 * chg);
	// визуал удара
	const c = EL[el] || EL.phys,
		hy = tg.y - (tg.rad > 30 ? 60 : 28) - (tg.z || 0);
	if (o.dot) Fx.num(tg, dm, "dot", c.c);
	else {
		Fx.num(tg, crit ? fmt(dm) + "!" : dm, crit ? "crit" : tg.team ? "dmg" : "hit");
		burst(tg.x, hy, crit ? 14 : 5, { c: [c.c, c.c2], sp: crit ? 260 : 150, s: crit ? 6 : 4, life: 0.35, sv: 0.6 });
		if (el === "fire") burst(tg.x, hy, 3, { c: ["#ff8a3c", "#ffe27a"], k: 1, s: 7, g: -160, sp: 40, life: 0.5 });
		else if (el === "ice") burst(tg.x, hy, 4, { c: ["#ffffff", "#9fe8ff"], k: 4, s: 6, sp: 130, life: 0.45, g: 300 });
		else if (el === "poison") burst(tg.x, hy, 3, { c: "rgba(155,224,78,.6)", k: 5, s: 6, e: 2, g: -40, sp: 30, life: 0.6 });
		else if (el === "dark") burst(tg.x, hy, 4, { c: ["#b06cff", "#5a2a9a"], k: 1, s: 7, g: -60, sp: 60, life: 0.55 });
		else if (el === "holy") burst(tg.x, hy, 4, { c: ["#fff3b0", "#ffffff"], k: 1, s: 6, g: -90, sp: 70, life: 0.5 });
		else if (el === "bolt" || el === "prism") Fx.add({ k: "bolt", x0: tg.x + rr(-30, 30), y0: hy - 50, x1: tg.x, y1: hy, c: c.c, d: 0.12 });
		if (crit) {
			ring(tg.x, hy, 70, c.c2, 0.28, 6, 1, 1);
			Fx.add({ k: "star", x: tg.x, y: hy, c: c.c2, d: 0.2 });
			shake(0.12);
			sfx("crit");
		} else if (!o.quiet) sfx(o.snd || (el === "phys" || el === "nature" ? "hit" : el), 0.8);
	}
	// срабатывания
	if (src && !o.dot && !o.proc) {
		if (!src.team) {
			if (F.rb.ls) heal(src, dm * F.rb.ls);
			if (F.rb.psn) addSt(tg, "poison", 3, src.atk * F.rb.psn);
			if (F.rb.frz && Rand.next() < F.rb.frz) {
				addSt(tg, "stun", 1);
				if (tg.st.stun) tg.st.stun.ice = 1;
				sfx("ice");
			}
			if (crit && F.rb.chain) {
				liv(F.en)
					.filter((e) => e !== tg && dist(e, tg) < 240)
					.slice(0, 2)
					.forEach((e) => {
						Fx.add({ k: "bolt", x0: tg.x, y0: hy, x1: e.x, y1: e.y - 28, c: "#fff27a", d: 0.18 });
						hurt(src, e, dm * F.rb.chain, { pure: 1, proc: 1, nocrit: 1, el: "bolt" });
					});
			}
		} else {
			const stt = EL[src.el] && EL[src.el].st;
			if (stt && Rand.next() < (o.stc || 0.2)) addSt(tg, stt, stt === "chill" ? 2.5 : stt === "curse" ? 4 : 3, src.atk * (stt === "poison" ? 0.1 : 0.12));
		}
	}
	return dm;
}
function knock(u, fx, fy, pow) {
	if (u.boss || u.inv > 0) return;
	const d = Math.hypot(u.x - fx, u.y - fy) || 1;
	u.kx = ((u.x - fx) / d) * pow * 4;
	u.ky = ((u.y - fy) / d) * pow * 2;
}
function aoe(src, x, y, r, mul, o = {}) {
	const foes = liv(src.team ? F.pl : F.en);
	let n = 0;
	for (const e of foes) {
		const dx = e.x - x,
			dy = (e.y - y) * 1.6;
		if (dx * dx + dy * dy < (r + e.rad) * (r + e.rad)) {
			hurt(src, e, eAtk(src) * mul, o);
			if (o.kb) knock(e, x, y, o.kb);
			if (o.stun) addSt(e, "stun", o.stun);
			n++;
		}
	}
	hitProps(x, y, r, 3);
	return n;
}
// снаряд: tg — самонаводящийся; иначе летит прямо и разбивается о препятствия
function shoot(src, tg, dmg, o = {}) {
	const el = o.el || src.el || "phys",
		sx = src.x + src.face * 18,
		sy = src.y - (src.rad > 30 ? 70 : 34);
	F.proj.push({ x: sx, y: sy, tg: o.lin ? null : tg, vx: o.vx || 0, vy: o.vy || 0, sp: o.sp || 560, dmg, src, el, team: src.team, life: 2.2, o, r: o.r || 16, tr: 0 });
}
// ---------- способности героев ----------
const nearest = (u, list) => {
	let b = null,
		bd = 1e9;
	for (const e of list) {
		const d = dist(u, e);
		if (d < bd) {
			bd = d;
			b = e;
		}
	}
	return b;
};
function cutIn(u, name, ult) {
	Fx.add({ k: "cut", u, s: name, ult, d: ult ? 1.1 : 0.8 });
	sfx(ult ? "ult" : "abil");
	if (ult) {
		slowmo(0.35, 0.35);
		ring(u.x, u.y - 20, 150, EL[KIT[u.k].el].c, 0.5, 6, 0.6, 1);
	}
}
const CAST = {
	mage: {
		ab(u) {
			const tg = nearest(u, liv(F.en));
			if (!tg || dist(u, tg) > 360) return false;
			anim(u, "cast", 0.5);
			cutIn(u, KIT.mage.ab.n);
			Fx.add({ k: "vines", u: tg, d: 1.5 });
			burst(tg.x, tg.y - 6, 12, { c: ["#5aa03c", "#8be06a", "#3a6a2a"], sp: 120, up: 120, s: 6, life: 0.6, fl: tg.y + 2 });
			hurt(u, tg, eAtk(u) * 1.2, { abil: 1, el: "nature" });
			addSt(tg, "stun", 1.5);
			return true;
		},
		ult(u) {
			anim(u, "ult", 1);
			cutIn(u, KIT.mage.ult.n, 1);
			F.pl.forEach((a) => heal(a, a.max * 0.25, u));
			liv(F.en).forEach((e, i) => Seq.at(0.15 + i * 0.08, () => S === "fight" && u.hp > 0 && e.hp > 0 && shoot(u, e, eAtk(u) * 1.5, { el: "nature", abil: 1, sp: 420, big: 1 })));
			Fx.add({ k: "wave", x: u.x, y: u.y, c: "#8be06a", d: 0.8 });
			return true;
		},
	},
	knight: {
		ab(u) {
			const tg = u.tg;
			if (!tg || tg.hp <= 0 || dist(u, tg) > 120 + tg.rad) return false;
			anim(u, "atk", 0.36);
			cutIn(u, KIT.knight.ab.n);
			Fx.add({ k: "slash", x: u.x + u.face * 30, y: u.y - 34, f: u.face, r: 86, c: "#fff3b0", d: 0.22, w: 12 });
			for (const e of liv(F.en)) if ((e.x - u.x) * u.face > -20 && dist(e, u) < 120 + e.rad) (hurt(u, e, eAtk(u) * 1.4, { abil: 1, el: "holy" }), knock(e, u.x, u.y, 60));
			hitProps(u.x + u.face * 50, u.y, 60, 3);
			return true;
		},
		ult(u) {
			const tg = u.tg && u.tg.hp > 0 ? u.tg : nearest(u, liv(F.en));
			if (!tg) return false;
			anim(u, "ult", 1);
			cutIn(u, KIT.knight.ult.n, 1);
			u.inv = Math.max(u.inv, 0.9);
			const lx = clamp(tg.x - (tg.x > u.x ? 1 : -1) * (26 + tg.rad), FLD.x0, FLD.x1);
			u.jump = {
				x0: u.x,
				y0: u.y,
				x1: lx,
				y1: tg.y,
				t: 0,
				d: 0.6,
				h: 150,
				fn() {
					Fx.add({ k: "pillar", x: tg.x, y: tg.y, c: "#fff3b0", w: 90, d: 0.6 });
					ring(tg.x, tg.y, 190, "#fff3b0", 0.5, 9);
					burst(tg.x, tg.y - 10, 26, { c: ["#fff3b0", "#ffffff", "#ffd27a"], sp: 340, s: 6, life: 0.7, up: 120, fl: tg.y + 6, bn: 0.4 });
					aoe(u, tg.x, tg.y, 130, 4, { abil: 1, el: "holy", stun: 1.5, kb: 40 });
					shake(0.5);
					slowmo(0.3, 0.25);
					sfx("boom");
				},
			};
			return true;
		},
	},
	paladin: {
		ab(u) {
			anim(u, "cast", 0.5);
			cutIn(u, KIT.paladin.ab.n);
			const v = Math.round(u.max * 0.12),
				al = liv(F.pl)
					.filter((a) => a !== u)
					.sort((p, q) => p.hp / p.max - q.hp / q.max)[0];
			[u, al].forEach((a) => {
				if (!a) return;
				a.sh += v;
				a.shT = 5;
				Fx.add({ k: "bubble", u: a, c: "#fff3b0", d: 0.6 });
			});
			liv(F.en).forEach((e) => {
				if (dist(e, u) < 240 && !e.boss) e.tau = { u, t: 3 };
			});
			ring(u.x, u.y, 240, "#fff3b0", 0.5, 5);
			sfx("holy");
			return true;
		},
		ult(u) {
			anim(u, "ult", 1);
			cutIn(u, KIT.paladin.ult.n, 1);
			F.pl.forEach((a) => {
				a.inv = Math.max(a.inv, 2);
				heal(a, a.max * 0.15, u);
				Fx.add({ k: "bubble", u: a, c: "#fff3b0", d: 2 });
			});
			Fx.add({ k: "pillar", x: u.x, y: u.y, c: "#fff3b0", w: 150, d: 0.9 });
			ring(u.x, u.y, 240, "#ffffff", 0.6, 9);
			aoe(u, u.x, u.y, 170, 2.5, { abil: 1, el: "holy" });
			shake(0.4);
			sfx("holy");
			return true;
		},
	},
	bandit: {
		ab(u) {
			const tg = liv(F.en).sort((p, q) => p.hp / p.max - q.hp / q.max)[0];
			if (!tg) return false;
			cutIn(u, KIT.bandit.ab.n);
			Fx.add({ k: "ghost", u, x: u.x, y: u.y, f: u.face, d: 0.35 });
			Fx.add({ k: "beam", x0: u.x, y0: u.y - 30, x1: tg.x, y1: tg.y - 30, c: "#c9a0ff", d: 0.18, w: 5 });
			const sd = tg.x > u.x ? 1 : -1;
			[u.x, u.y] = placeFree(F.A, tg.x + sd * (24 + tg.rad), tg.y);
			u.face = -sd;
			anim(u, "atk", 0.3, false);
			hurt(u, tg, eAtk(u) * 1.1, { crit: 1, abil: 1 });
			Fx.add({ k: "slash", x: tg.x, y: tg.y - 30, f: -sd, r: 60, c: "#e9d0ff", d: 0.18, w: 8 });
			return true;
		},
		ult(u) {
			if (!liv(F.en).length) return false;
			cutIn(u, KIT.bandit.ult.n, 1);
			u.inv = Math.max(u.inv, 1.5);
			u.ulc = { n: 6, t: 0 };
			return true;
		},
	},
	frost: {
		ab(u) {
			const tg = u.tg;
			if (!tg || tg.hp <= 0 || dist(u, tg) > 120 + tg.rad) return false;
			anim(u, "atk", 0.36);
			cutIn(u, KIT.frost.ab.n);
			Fx.add({ k: "slash", x: u.x + u.face * 30, y: u.y - 34, f: u.face, r: 86, c: "#9fe8ff", d: 0.22, w: 12 });
			hurt(u, tg, eAtk(u) * 1.3, { abil: 1, el: "ice" });
			addSt(tg, "chill", 2.5);
			burst(tg.x, tg.y - 20, 8, { c: ["#9fe8ff", "#ffffff"], sp: 160, s: 4, life: 0.4 });
			return true;
		},
		ult(u) {
			anim(u, "ult", 1);
			cutIn(u, KIT.frost.ult.n, 1);
			ring(u.x, u.y, 200, "#9fe8ff", 0.5, 7);
			for (const e of liv(F.en)) if (dist(e, u) < 190 + e.rad) { hurt(u, e, eAtk(u) * 2.5, { abil: 1, el: "ice" }); addSt(e, "stun", 1); }
			burst(u.x, u.y - 30, 20, { c: ["#9fe8ff", "#ffffff", "#bfeaff"], sp: 300, s: 5, life: 0.6, up: 80, fl: u.y + 4 });
			shake(0.3);
			sfx("ice");
			return true;
		},
	},
	pyro: {
		ab(u) {
			const tg = u.tg;
			if (!tg || tg.hp <= 0 || dist(u, tg) > 120 + tg.rad) return false;
			anim(u, "atk", 0.36);
			cutIn(u, KIT.pyro.ab.n);
			Fx.add({ k: "slash", x: u.x + u.face * 30, y: u.y - 34, f: u.face, r: 86, c: "#ff8a3c", d: 0.22, w: 12 });
			hurt(u, tg, eAtk(u) * 1.4, { abil: 1, el: "fire" });
			addSt(tg, "burn", 3, eAtk(u) * 0.12);
			return true;
		},
		ult(u) {
			const tg = u.tg && u.tg.hp > 0 ? u.tg : nearest(u, liv(F.en));
			if (!tg) return false;
			anim(u, "ult", 1);
			cutIn(u, KIT.pyro.ult.n, 1);
			u.inv = Math.max(u.inv, 0.9);
			const lx = clamp(tg.x - (tg.x > u.x ? 1 : -1) * (26 + tg.rad), FLD.x0, FLD.x1);
			u.jump = { x0: u.x, y0: u.y, x1: lx, y1: tg.y, t: 0, d: 0.6, h: 150, fn() { Fx.add({ k: "pillar", x: tg.x, y: tg.y, c: "#ff8a3c", w: 90, d: 0.6 }); ring(tg.x, tg.y, 190, "#ff8a3c", 0.5, 9); burst(tg.x, tg.y - 10, 26, { c: ["#ff8a3c", "#ffe27a", "#ffffff"], sp: 340, s: 6, life: 0.7, up: 120, fl: tg.y + 6, bn: 0.4 }); aoe(u, tg.x, tg.y, 130, 3.5, { abil: 1, el: "fire" }); for (const e of liv(F.en)) if (dist(e, tg) < 150 + e.rad) addSt(e, "burn", 3, eAtk(u) * 0.12); shake(0.5); slowmo(0.3, 0.25); sfx("boom"); } };
			return true;
		},
	},
	necro: {
		ab(u) {
			const tg = nearest(u, liv(F.en));
			if (!tg || dist(u, tg) > 360) return false;
			anim(u, "cast", 0.5);
			cutIn(u, KIT.necro.ab.n);
			hurt(u, tg, eAtk(u) * 1.2, { abil: 1, el: "dark" });
			addSt(tg, "curse", 4);
			Fx.add({ k: "beam", x0: u.x, y0: u.y - 40, x1: tg.x, y1: tg.y - 30, c: "#b06cff", d: 0.25, w: 5 });
			return true;
		},
		ult(u) {
			anim(u, "ult", 1);
			cutIn(u, KIT.necro.ult.n, 1);
			liv(F.en).forEach((e, i) => Seq.at(0.15 + i * 0.08, () => S === "fight" && u.hp > 0 && e.hp > 0 && shoot(u, e, eAtk(u) * 2, { el: "dark", abil: 1, sp: 420, big: 1 })));
			liv(F.en).forEach((e) => addSt(e, "curse", 4));
			Fx.add({ k: "wave", x: u.x, y: u.y, c: "#b06cff", d: 0.8 });
			return true;
		},
	},
	volt: {
		ab(u) {
			const tg = nearest(u, liv(F.en));
			if (!tg || dist(u, tg) > 360) return false;
			anim(u, "cast", 0.5);
			cutIn(u, KIT.volt.ab.n);
			const list = liv(F.en).sort((a, b) => dist(u, a) - dist(u, b)).slice(0, 3);
			list.forEach((e, i) => { hurt(u, e, eAtk(u) * 1.1, { abil: 1, el: "bolt" }); if (i > 0) Fx.add({ k: "bolt", x0: list[i-1].x, y0: list[i-1].y - 30, x1: e.x, y1: e.y - 30, c: "#fff27a", d: 0.18, w: 4 }); });
			Fx.add({ k: "bolt", x0: u.x, y0: u.y - 40, x1: tg.x, y1: tg.y - 30, c: "#fff27a", d: 0.18, w: 4 });
			sfx("bolt");
			return true;
		},
		ult(u) {
			anim(u, "ult", 1);
			cutIn(u, KIT.volt.ult.n, 1);
			const foes = liv(F.en);
			if (!foes.length) return false;
			for (let i = 0; i < 5; i++) { const e = pick(foes); if (e && e.hp > 0) { hurt(u, e, eAtk(u) * 1.2, { abil: 1, el: "bolt" }); addSt(e, "shock", 1.5); Fx.add({ k: "bolt", x0: u.x + rr(-40, 40), y0: -10, x1: e.x, y1: e.y - 30, c: "#fff27a", d: 0.2, w: 5 }); } }
			shake(0.3);
			sfx("bolt");
			return true;
		},
	},
	druid: {
		ab(u) {
			const tg = nearest(u, liv(F.en));
			if (!tg || dist(u, tg) > 360) return false;
			anim(u, "cast", 0.5);
			cutIn(u, KIT.druid.ab.n);
			Fx.add({ k: "vines", u: tg, d: 1.5 });
			hurt(u, tg, eAtk(u) * 1.1, { abil: 1, el: "nature" });
			addSt(tg, "stun", 1.5);
			return true;
		},
		ult(u) {
			anim(u, "ult", 1);
			cutIn(u, KIT.druid.ult.n, 1);
			F.pl.forEach((a) => heal(a, a.max * 0.2, u));
			liv(F.en).forEach((e, i) => Seq.at(0.15 + i * 0.08, () => S === "fight" && u.hp > 0 && e.hp > 0 && shoot(u, e, eAtk(u) * 1.4, { el: "nature", abil: 1, sp: 420, big: 1 })));
			Fx.add({ k: "wave", x: u.x, y: u.y, c: "#8be06a", d: 0.8 });
			return true;
		},
	},
	shade: {
		ab(u) {
			const tg = liv(F.en).sort((p, q) => p.hp / p.max - q.hp / q.max)[0];
			if (!tg) return false;
			cutIn(u, KIT.shade.ab.n);
			Fx.add({ k: "ghost", u, x: u.x, y: u.y, f: u.face, d: 0.35 });
			const sd = tg.x > u.x ? 1 : -1;
			[u.x, u.y] = placeFree(F.A, tg.x + sd * (24 + tg.rad), tg.y);
			u.face = -sd;
			u.inv = Math.max(u.inv, 0.5);
			anim(u, "atk", 0.3, false);
			hurt(u, tg, eAtk(u) * 1.3, { crit: 1, abil: 1, el: "dark" });
			Fx.add({ k: "slash", x: tg.x, y: tg.y - 30, f: -sd, r: 60, c: "#b2ebf2", d: 0.18, w: 8 });
			return true;
		},
		ult(u) {
			if (!liv(F.en).length) return false;
			cutIn(u, KIT.shade.ult.n, 1);
			u.inv = Math.max(u.inv, 1.5);
			u.ulc = { n: 6, t: 0 };
			return true;
		},
	},
	golem: {
		ab(u) {
			anim(u, "cast", 0.5);
			cutIn(u, KIT.golem.ab.n);
			const v = Math.round(u.max * 0.2);
			const al = liv(F.pl).filter((a) => a !== u).sort((p, q) => p.hp / p.max - q.hp / q.max)[0];
			[u, al].forEach((a) => { if (!a) return; a.sh += v; a.shT = 5; Fx.add({ k: "bubble", u: a, c: "#cfd8dc", d: 0.6 }); });
			liv(F.en).forEach((e) => { if (dist(e, u) < 240 && !e.boss) e.tau = { u, t: 3 }; });
			ring(u.x, u.y, 240, "#cfd8dc", 0.5, 5);
			sfx("holy");
			return true;
		},
		ult(u) {
			anim(u, "ult", 1);
			cutIn(u, KIT.golem.ult.n, 1);
			ring(u.x, u.y, 260, "#cfd8dc", 0.6, 9);
			aoe(u, u.x, u.y, 180, 3, { abil: 1, el: "phys", stun: 1.5, kb: 60 });
			shake(0.5);
			sfx("boom");
			return true;
		},
	},
	archer: {
		ab(u) {
			const tg = nearest(u, liv(F.en));
			if (!tg || dist(u, tg) > 420) return false;
			anim(u, "atk", 0.36);
			cutIn(u, KIT.archer.ab.n);
			shoot(u, tg, eAtk(u) * 1.8, { el: "nature", abil: 1, sp: 700, big: 1 });
			sfx("zap", 0.7);
			return true;
		},
		ult(u) {
			anim(u, "ult", 1);
			cutIn(u, KIT.archer.ult.n, 1);
			const foes = liv(F.en);
			if (!foes.length) return false;
			for (let i = 0; i < 6; i++) { const e = pick(foes); if (e && e.hp > 0) shoot(u, e, eAtk(u) * 1.1, { el: "nature", abil: 1, sp: 620, big: 1 }); }
			sfx("zap", 0.7);
			return true;
		},
	},
	prism: {
		ab(u) {
			const tg = u.tg;
			if (!tg || tg.hp <= 0 || dist(u, tg) > 300) return false;
			anim(u, "cast", 0.5);
			cutIn(u, KIT.prism.ab.n);
			Fx.add({ k: "beam", x0: u.x, y0: u.y - 40, x1: u.x + u.face * 260, y1: u.y - 30, c: "#ff8af0", d: 0.25, w: 8 });
			for (const e of liv(F.en)) if ((e.x - u.x) * u.face > -20 && dist(e, u) < 280 + e.rad) hurt(u, e, eAtk(u) * 1.5, { abil: 1, el: "prism" });
			return true;
		},
		ult(u) {
			anim(u, "ult", 1);
			cutIn(u, KIT.prism.ult.n, 1);
			ring(u.x, u.y, 220, "#ff8af0", 0.5, 7);
			aoe(u, u.x, u.y, 170, 3.2, { abil: 1, el: "prism" });
			for (const e of liv(F.en)) if (dist(e, u) < 200 + e.rad) addSt(e, "shock", 1.5);
			shake(0.3);
			sfx("bolt");
			return true;
		},
	},
	vamp: {
		ab(u) {
			const tg = u.tg;
			if (!tg || tg.hp <= 0 || dist(u, tg) > 120 + tg.rad) return false;
			anim(u, "atk", 0.36);
			cutIn(u, KIT.vamp.ab.n);
			Fx.add({ k: "slash", x: u.x + u.face * 30, y: u.y - 34, f: u.face, r: 86, c: "#e53935", d: 0.22, w: 10 });
			const d = hurt(u, tg, eAtk(u) * 1.3, { abil: 1, el: "dark" });
			if (d > 0) heal(u, d * 0.5, u);
			return true;
		},
		ult(u) {
			const foes = liv(F.en);
			if (!foes.length) return false;
			anim(u, "ult", 1);
			cutIn(u, KIT.vamp.ult.n, 1);
			let healed = 0;
			for (let i = 0; i < 5; i++) { const e = pick(foes); if (e && e.hp > 0) { const d = hurt(u, e, eAtk(u) * 1.1, { abil: 1, el: "dark" }); healed += d; Fx.add({ k: "slash", x: e.x, y: e.y - 30, f: u.face, r: 56, c: "#e53935", d: 0.16, w: 8 }); } }
			if (healed > 0) heal(u, healed * 0.3, u);
			return true;
		},
	},
};
// ---------- фабрика героев для Arena AI ----------
// Arena AI добавляет героев через regHero(def). def: {k,n,rows,pal,hp,atk,aspd,arm,rng,spd,heal,role,crit,el,ab:{n,cd,d},ult:{n,d},rar,desc,sc,castAb,castUlt}
// rows — пиксельная карта idle (строки, '.' — прозрачно, остальные символы — цвета из pal или PAL).
// Спрайты строятся на canvas в рантайме (без base64), анимации — сдвигом кадра (дыхание/ходьба/удар).
const NEW_HEROES = [];
function sprBig(rows, pal) {
	const h = rows.length, w = Math.max(...rows.map((r) => r.length));
	const c = document.createElement("canvas");
	c.width = w; c.height = h;
	const x = c.getContext("2d");
	rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== ".") { x.fillStyle = (pal && pal[ch]) || PAL[ch] || "#fff"; x.fillRect(i, j, 1, 1); } }));
	const d = x.getImageData(0, 0, w, h).data, o = x.createImageData(w, h), q = o.data;
	const A = (i, j) => (i < 0 || j < 0 || i >= w || j >= h ? 0 : d[(j * w + i) * 4 + 3]);
	for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
		const k = (j * w + i) * 4;
		if (d[k + 3]) {
			let m = 1, a = 0;
			if (!A(i, j - 1) || !A(i - 1, j)) a = 45;
			else if (!A(i, j + 1) || !A(i + 1, j)) m = 0.68;
			else if (j > h - 6) m = 0.88;
			q[k] = Math.min(255, d[k] * m + a); q[k + 1] = Math.min(255, d[k + 1] * m + a); q[k + 2] = Math.min(255, d[k + 2] * m + a); q[k + 3] = 255;
		} else if (A(i - 1, j) || A(i + 1, j) || A(i, j - 1) || A(i, j + 1)) { q[k] = 10; q[k + 1] = 8; q[k + 2] = 18; q[k + 3] = 255; }
	}
	x.putImageData(o, 0, 0);
	return c;
}
function regHero(def) {
	if (!def || !def.k || !def.n || !def.rows || !def.rows.length) throw new Error("regHero: нужны k, n, rows");
	if (HEROES.some((h) => h.k === def.k)) throw new Error("regHero: ключ " + def.k + " уже есть");
	const base = sprBig(def.rows, def.pal || {});
	const w = base.width, h = base.height;
	const c = document.createElement("canvas");
	c.width = w * 4; c.height = h * 5;
	const x = c.getContext("2d");
	const put = (idx, dy, dx) => { x.drawImage(base, (idx % 4) * w + (dx || 0), ((idx / 4) | 0) * h + (dy || 0)); };
	for (let i = 0; i < 20; i++) put(i, 0, 0);
	// лёгкие вариации: idle1 выше на 1px, walk — качание, atk — наклон вперёд
	const F = (idx, dy) => [ (idx % 4) * w, ((idx / 4) | 0) * h, w, h, w / 2, h + (dy || 0) ];
	const ax = w / 2, ay = h;
	ATL.heroes2[def.k] = {
		idle: [F(0), F(1, -1), F(2)],
		walk: [F(3), F(4), F(5), F(6)],
		atk: [F(7, -1), F(8, 1), F(9)],
		hurt: [F(10)],
		dead: [F(11), F(12, 2)],
		cast: [F(13, -1)],
		ult: [F(14, -1), F(15, 1)],
		win: [F(16, -2), F(17)],
		port: [F(18)],
	};
	IMG["gen_" + def.k] = c;
	const hero = { n: def.n, spr: KN, k: def.k, hp: def.hp || 2500, atk: def.atk || 70, aspd: def.aspd || 0.85, arm: def.arm || 15, rng: def.rng || 50, spd: def.spd || 6, sc: def.sc || 0.7, rar: def.rar || 2, desc: def.desc || "" };
	if (def.heal) hero.heal = def.heal;
	HEROES.push(hero);
	KIT[def.k] = { role: def.role || "Воин", crit: def.crit || 0.07, el: def.el || "phys", ab: def.ab || { n: "Удар", cd: 6, d: "Мощный удар." }, ult: def.ult || { n: "Штурм", d: "Удар по области." } };
	CAST[def.k] = {
		ab: def.castAb || function (u) { const tg = u.tg; if (!tg || tg.hp <= 0 || dist(u, tg) > 140 + tg.rad) return false; anim(u, "atk", 0.36); cutIn(u, KIT[u.k].ab.n); hurt(u, tg, eAtk(u) * 1.3, { abil: 1, el: KIT[u.k].el }); return true; },
		ult: def.castUlt || function (u) { anim(u, "ult", 1); cutIn(u, KIT[u.k].ult.n, 1); aoe(u, u.x, u.y, 170, 2.5, { abil: 1, el: KIT[u.k].el }); return true; },
	};
	NEW_HEROES.push(def.k);
	return def.k;
}
// ---------- боссы ----------
function bossPhase(u) {
	const B = WORLDS[F.w].boss;
	u.bph++;
	u.gate = u.gates[u.bph] !== undefined ? u.max * u.gates[u.bph] : undefined;
	u.inv = 2.3;
	u.bp = null;
	u.jump = null;
	u.bt = 2.6;
	u.pi = 0;
	u.atk = Math.round(u.atk * 1.15);
	u.spd += 1.5;
	u.aspd = +(u.aspd * 1.15).toFixed(2);
	u.st = {};
	F.lock = 1.9;
	F.proj = [];
	F.tele = [];
	anim(u, "cast", 1.9);
	const nm = u.bph === 1 ? B.n2 : B.n3 || B.n2;
	u.n = nm;
	F.fx.push({ k: "banner", s: nm, s2: "Фаза " + ["II", "III"][u.bph - 1], t: 0, d: 1.9, c: "#ff5a6a" });
	F.fx.push({ k: "flash", t: 0, d: 0.5, c: "#ffffff" });
	ring(u.x, u.y, 520, "#ff5a6a", 0.9, 12);
	ring(u.x, u.y, 300, "#ffffff", 0.6, 8);
	burst(u.x, u.y - 60, 40, { c: ["#ff5a6a", "#ffd27a", "#ffffff"], sp: 420, s: 8, life: 0.9, sv: 0.7 });
	shake(0.8);
	slowmo(0.25, 0.5);
	sfx("roar");
	F.pl.forEach((p) => knock(p, u.x, u.y, 110));
	// арена меняется: ломается всё хрупкое, темнеет, остаются лужи стихии
	F.A.obs.forEach((o) => o.hp && breakProp(F.A, o));
	F.A.tod = 2;
	const el = WORLDS[F.w].el;
	for (let i = 0; i < 2 + u.bph; i++) F.A.pools.push({ x: rr(260, 760), y: rr(F.A.y0 + 20, FLD.y1 - 10), r: 54, el: el === "nature" ? "poison" : el, t: 0, life: 14, src: u, tk: 0 });
}
function tele(o) {
	o.t = 0;
	F.tele.push(o);
}
const BOSSP = {
	slam(u) {
		const tg = pick(liv(F.pl));
		if (!tg) return;
		anim(u, "cast", 0.9);
		const x1 = clamp(tg.x + 40, FLD.x0 + 40, FLD.x1 - 30),
			y1 = clamp(tg.y, F.A.y0 + 10, FLD.y1);
		tele({ x: x1, y: y1, r: 130, d: 0.95, c: "#ff5a4a" });
		u.jump = {
			x0: u.x,
			y0: u.y,
			x1,
			y1,
			t: 0,
			d: 0.95,
			h: 190,
			fn() {
				aoe(u, x1, y1, 130, 1.6, { kb: 80, stc: 0.5 });
				ring(x1, y1, 220, EL[u.el].c, 0.55, 10);
				ring(x1, y1, 140, "#ffffff", 0.35, 6);
				burst(x1, y1, 24, { c: [EL[u.el].c, "#ffffff", "#5a4a3a"], sp: 320, s: 7, life: 0.7, up: 140, fl: y1 + 8, bn: 0.4 });
				shake(0.7);
				sfx("boom");
				anim(u, "atk", 0.5);
			},
		};
	},
	summon(u) {
		anim(u, "cast", 0.8);
		sfx("roar", 0.6);
		const n = Math.min(2 + u.bph, 7 - liv(F.en).length);
		for (let i = 0; i < n; i++) {
			const [x, y] = placeFree(F.A, u.x - 90 - i * 40 + rr(-20, 20), u.y + rr(-70, 70)),
				s = mkU(foeDef(F.w, "a"), 1, x, y, F.m * 0.55);
			s.spw = 0.5 + i * 0.12;
			s.born = t + i * 0.12;
			s.add = 1;
			F.en.push(s);
			ring(x, y, 60, EL[u.el].c, 0.5, 5);
		}
	},
	volley(u) {
		const tg = nearest(u, liv(F.pl));
		if (!tg) return;
		anim(u, "cast", 0.9);
		const phase = u.bph, n = 5 + u.bph * 2,
			a0 = Math.atan2(tg.y - u.y, tg.x - u.x);
		for (let i = 0; i < n; i++) {
			const a = a0 + (i - (n - 1) / 2) * 0.17;
			tele({ shape: "line", x: u.x, y: u.y - 20, a, len: 620, d: 0.55, c: EL[u.el].c });
			Seq.at(0.55 + i * 0.04, () => S === "fight" && u.hp > 0 && u.bph === phase && shoot(u, null, eAtk(u) * 0.6, { lin: 1, vx: Math.cos(a) * 470, vy: Math.sin(a) * 470, stc: 0.5, big: 1 }));
		}
	},
	rain(u) {
		anim(u, "cast", 0.8);
		const phase = u.bph, pl = liv(F.pl),
			n = 4 + u.bph * 2;
		for (let i = 0; i < n; i++) {
			const p = pl[i % pl.length];
			if (!p) break;
			const x = clamp(p.x + rr(-60, 60), FLD.x0, FLD.x1),
				y = clamp(p.y + rr(-34, 34), F.A.y0, FLD.y1);
			Seq.at(i * 0.16, () => {
				if (S !== "fight" || u.hp <= 0 || u.bph !== phase) return;
				tele({
					x,
					y,
					r: 58,
					d: 1,
					c: EL[u.el].c,
					fn() {
						if (u.hp <= 0) return;
						Fx.add({ k: "pillar", x, y, c: EL[u.el].c, w: 44, d: 0.35 });
						aoe(u, x, y, 58, 1.1, { stc: 0.6 });
						ring(x, y, 90, EL[u.el].c, 0.35, 5);
						burst(x, y, 10, { c: [EL[u.el].c, EL[u.el].c2], sp: 220, s: 6, life: 0.5, up: 100, fl: y + 4 });
						shake(0.18);
						sfx(u.el === "nature" ? "boom" : u.el, 0.8);
					},
				});
			});
		}
	},
	wave(u) {
		const tg = liv(F.pl).sort((p, q) => p.hp / p.max - q.hp / q.max)[0];
		if (!tg) return;
		anim(u, "cast", 1);
		const y = clamp(tg.y, F.A.y0 + 26, FLD.y1 - 20);
		tele({
			shape: "band",
			y,
			h: 58,
			d: 1.05,
			c: EL[u.el].c,
			fn() {
				if (u.hp <= 0) return;
				Fx.add({ k: "sweep", y, h: 58, x0: u.x, c: EL[u.el].c, d: 0.5 });
				for (const p of liv(F.pl))
					if (Math.abs(p.y - y) < 32 && p.x < u.x) {
						hurt(u, p, eAtk(u) * 1.2, { stc: 0.4 });
						knock(p, p.x + 100, p.y, 90);
					}
				for (const o of F.A.obs) if (o.hp && Math.abs(o.y - y) < 34) breakProp(F.A, o);
				shake(0.3);
				sfx("boom", 0.8);
			},
		});
	},
	pools(u) {
		anim(u, "cast", 0.8);
		sfx(u.el === "nature" ? "poison" : u.el);
		const el = u.el === "nature" ? "poison" : u.el;
		liv(F.pl)
			.slice(0, 3)
			.forEach((p) => {
				const x = p.x + rr(-30, 30),
					y = clamp(p.y + rr(-16, 16), F.A.y0, FLD.y1);
				tele({ x, y, r: 54, d: 0.8, c: EL[el].c, fn: () => u.hp > 0 && F.A.pools.push({ x, y, r: 54, el, t: 0, life: 8, src: u, tk: 0 }) });
			});
	},
	shield(u) {
		anim(u, "cast", 0.8);
		u.sh += Math.round(u.max * 0.1);
		u.shT = 7;
		addSt(u, "rage", 7);
		Fx.add({ k: "bubble", u, c: EL[u.el].c, d: 1.2 });
		ring(u.x, u.y, 200, EL[u.el].c, 0.5, 7);
		sfx("holy");
	},
	drain(u) {
		anim(u, "cast", 2.6);
		u.bp = { k: "drain", t: 2.6, tk: 0 };
		sfx("dark");
	},
};
function bossStep(u, h) {
	if (u.bp) {
		const b = u.bp;
		b.t -= h;
		b.tk += h;
		if (b.k === "drain" && b.tk >= 0.4) {
			b.tk = 0;
			for (const p of liv(F.pl))
				if (dist(p, u) < 460) {
					const d = hurt(u, p, eAtk(u) * 0.22, { el: "dark", quiet: 1, nocrit: 1 });
					u.hp = Math.min(u.max, u.hp + d * 2);
					Fx.add({ k: "beam", x0: p.x, y0: p.y - 30, x1: u.x, y1: u.y - 70, c: "#b06cff", d: 0.3, w: 4 });
				}
		}
		if (b.t <= 0) u.bp = null;
		return true;
	}
	u.bt -= h;
	if (u.bt <= 0 && !u.jump) {
		const B = WORLDS[F.w].boss,
			list = u.bph === 0 ? B.p1 : u.bph === 1 ? B.p2 : B.p3 || B.p2,
			k = list[u.pi++ % list.length];
		u.bt = [5.6, 4.3, 3.5][u.bph] || 3.5;
		BOSSP[k](u);
		return true;
	}
	return false;
}
// ---------- шаг симуляции ----------
function unitStep(u, h) {
	if (u.hp <= 0) return;
	const hr = h / SPDX,
		A = F.A,
		s = u.st;
	u.atkT = Math.max(0, u.atkT - hr);
	u.hitT = Math.max(0, u.hitT - hr);
	u.mv = 0;
	if (u.inv > 0) u.inv -= h;
	if (u.shT > 0 && (u.shT -= h) <= 0) u.sh = 0;
	if (u.spw > 0) {
		u.spw -= hr;
		return;
	}
	if (u.an) {
		u.an.t += hr;
		if (u.an.t >= u.an.d) u.an = null;
	}
	for (const k in s) {
		const q = s[k];
		q.t -= h;
		if (k === "burn" || k === "poison") {
			q.tk += h;
			if (q.tk >= 0.5) {
				q.tk -= 0.5;
				hurt(null, u, q.v * 0.5, { pure: 1, dot: 1, el: k === "burn" ? "fire" : "poison" });
			}
		}
		if (q.t <= 0) delete s[k];
	}
	if (u.hp <= 0) return;
	// опасные покрытия и лужи боссов
	u.hz = (u.hz || 0) + h;
	if (u.hz >= 0.5) {
		u.hz = 0;
		const P = surfAt(A, u.x, u.y);
		if (P && P.haz && !u.z) {
			hurt(null, u, u.max * (u.boss ? 0.004 : 0.015), { pure: 1, dot: 1, el: P.haz });
			addSt(u, P.haz === "fire" ? "burn" : "poison", 2, u.max * 0.006);
		}
		if (!u.team)
			for (const p of A.pools)
				if (Math.hypot(u.x - p.x, (u.y - p.y) * 1.6) < p.r) {
					hurt(p.src, u, p.src.atk * 0.3, { dot: 1, el: p.el });
					if (p.el === "ice") addSt(u, "chill", 1.5);
				}
	}
	// Смертельное покрытие или лужа не должны позволить бойцу атаковать в этот же кадр.
	if (u.hp <= 0) return;
	if (u.kx || u.ky) {
		u.x += u.kx * h;
		u.y += u.ky * h;
		const k = Math.exp(-h * 9);
		u.kx *= k;
		u.ky *= k;
		if (Math.abs(u.kx) + Math.abs(u.ky) < 8) u.kx = u.ky = 0;
		navPush(A, u, u.rad);
	}
	if (u.jump) {
		const j = u.jump;
		j.t += h;
		const k = Math.min(1, j.t / j.d),
			q = ez.io(k);
		u.x = lerp(j.x0, j.x1, q);
		u.y = lerp(j.y0, j.y1, q);
		u.z = Math.sin(Math.PI * k) * j.h;
		if (k >= 1) {
			u.z = 0;
			u.jump = null;
			navPush(A, u, u.rad * 0.5);
			j.fn();
		}
		return;
	}
	if (s.stun) return;
	if (u.sw) {
		u.sw.t -= h;
		if (u.sw.t <= 0) {
			strike(u, u.sw.tg, u.sw.dmg);
			u.sw = null;
		}
	}
	const foes = liv(u.team ? F.pl : F.en);
	if (u.heal) {
		u.hc -= h;
		if (u.hc <= 0) {
			u.hc = 2;
			const al = liv(F.pl)
				.filter((a) => a.hp < a.max)
				.sort((p, q) => p.hp / p.max - q.hp / q.max);
			if (al.length) {
				heal(al[0], u.heal * Math.max(1, u.atk / 50), u);
				Fx.add({ k: "beam", x0: u.x + u.face * 14, y0: u.y - 60, x1: al[0].x, y1: al[0].y - 30, c: "#8be06a", d: 0.25, w: 3 });
				sfx("heal");
			}
		}
	}
	if (u.ulc) {
		// вихрь ударов бойца
		const c = u.ulc;
		c.t -= h;
		if (c.t <= 0) {
			const tg = pick(foes);
			if (!tg || c.n <= 0) u.ulc = null;
			else {
				c.n--;
				c.t = 0.2;
				Fx.add({ k: "ghost", u, x: u.x, y: u.y, f: u.face, d: 0.3 });
				const sd = Rand.next() < 0.5 ? 1 : -1;
				[u.x, u.y] = placeFree(A, tg.x + sd * (22 + tg.rad), tg.y + rr(-8, 8));
				u.face = -sd;
				anim(u, "atk", 0.2, false);
				hurt(u, tg, eAtk(u) * 0.9, { abil: 1 });
				Fx.add({ k: "slash", x: tg.x, y: tg.y - 30, f: -sd, r: 56, c: "#e9d0ff", d: 0.16, w: 8, rot: rr(-0.8, 0.8) });
			}
		}
		return;
	}
	if (u.dash) {
		// рывок шипача: летит по прямой, сбивает всех на пути, о камень — оглушается сам
		const d = u.dash;
		d.t -= h;
		u.x += d.dx * 560 * h;
		u.y += d.dy * 560 * h;
		u.mv = 1;
		if (Rand.next() < 0.6) Parts.add({ x: u.x, y: u.y - 4, vx: -d.dx * 40, vy: -20, life: 0.4, c: "rgba(220,210,190,.6)", s: 6, k: 5, e: 2, l: 0 });
		for (const p of liv(F.pl))
			if (!d.hit.has(p) && dist(p, u) < 34 + p.rad) {
				d.hit.add(p);
				hurt(u, p, eAtk(u) * 1.4, { stc: 0.4 });
				knock(p, u.x - d.dx * 20, u.y - d.dy * 20, 80);
			}
		let stop = d.t <= 0 || u.x <= FLD.x0 + 2 || u.x >= FLD.x1 - 2 || u.y <= A.y0 + 1 || u.y >= FLD.y1 - 1;
		for (const o of A.obs)
			if (!o.dead && Math.abs(o.x - u.x) < o.rx + 14 && Math.abs(o.y - u.y) < o.ry + 10) {
				if (o.hp) breakProp(A, o);
				else {
					stop = true;
					addSt(u, "stun", 1.2);
					Fx.num(u, "бум!", "txt", "#ffe27a");
					burst(u.x, u.y - 20, 8, { c: ["#ffe27a", "#ffffff"], sp: 160, s: 4, life: 0.4 });
					shake(0.15);
					sfx("hit");
				}
			}
		if (stop) {
			u.dash = null;
			navPush(A, u, u.rad);
		}
		return;
	}
	if (u.an && u.an.lock) return;
	if (!foes.length) return;
	let tg = null;
	if (u.tau && (u.tau.t -= h) > 0 && u.tau.u.hp > 0) tg = u.tau.u;
	else tg = nearest(u, foes);
	u.tg = tg;
	if (u.boss && bossStep(u, h)) return;
	if (!u.team) {
		const K = KIT[u.k];
		if (K) {
			u.en = Math.min(100, u.en + 2.2 * h * wxm("chg") * (1 + F.rb.chg));
			if (u.en >= 100 && (CFG.autoUlt !== false || u.ultQ) && CAST[u.k].ult(u)) {
				u.en = 0;
				u.ultQ = 0;
				return;
			}
			u.acd -= h;
			if (u.acd <= 0) {
				if (CAST[u.k].ab(u)) {
					u.acd = K.ab.cd * (1 - F.rb.cdr);
					return;
				}
				u.acd = 0.4;
			}
		}
	} else if (!u.boss && (u.slot === "m" || u.slot === "b")) {
		u.acd -= h;
		const d = dist(u, tg);
		if (u.acd <= 0) {
			if (u.slot === "m" && d < 520) {
				u.acd = rr(4.5, 6.5);
				anim(u, "cast", 0.4);
				shoot(u, pick(foes), eAtk(u) * 0.8, { sp: 380, stc: 0.5, big: 1 });
				sfx("spit");
				return;
			}
			if (u.slot === "b" && d > 110 && d < 460) {
				u.acd = rr(6.5, 9);
				const a = Math.atan2(tg.y - u.y, tg.x - u.x);
				anim(u, "cast", 0.7);
				tele({
					shape: "line",
					x: u.x,
					y: u.y,
					a,
					len: Math.min(430, d + 90),
					d: 0.7,
					c: "#ff5a4a",
					wd: 34,
					fn() {
						if (u.hp > 0 && !u.st.stun) {
							u.dash = { dx: Math.cos(a), dy: Math.sin(a), t: Math.min(430, d + 90) / 560, hit: new Set() };
							sfx("dash");
						}
					},
				});
				return;
			}
			u.acd = 0.5;
		}
	}
	const d = dist(u, tg),
		reach = eRng(u) * 0.6 + (tg.rad > 30 ? tg.rad - 14 : 0) + (u.rad > 30 ? u.rad - 14 : 0);
	if (Math.abs(tg.x - u.x) > 6) u.face = tg.x < u.x ? -1 : 1;
	if (d > reach) {
		u.mv = 1;
		const dir = navDir(A, u.x, u.y, tg.x, tg.y),
			k = 1 - Math.exp(-h * 14);
		u.vx += (dir[0] - u.vx) * k;
		u.vy += (dir[1] - u.vy) * k;
		let v = eSpd(u) * 14;
		if (u.set && !u.boss) {
			// слизни двигаются прыжками
			u.hop = (u.hop + h * (1.9 + u.spd * 0.1)) % 1;
			v *= u.hop < 0.62 ? 1.6 : 0.02;
			u.z = u.hop < 0.62 ? Math.sin((u.hop / 0.62) * Math.PI) * 15 : 0;
		} else if (u.k === "bandit") v *= 0.8 + 0.5 * Math.abs(Math.sin(F.time * 5 + u.ph)); // боец бежит рывками
		u.x += u.vx * v * h;
		u.y += u.vy * v * h;
		navPush(A, u, u.rad);
	} else {
		u.z = u.set ? Math.max(0, (u.z || 0) - h * 90) : 0;
		u.cd -= h;
		if (u.cd <= 0) {
			const as = eAspd(u),
				dur = Math.min(0.38, 0.72 / as);
			u.cd = 1 / as;
			u.atkT = u.atkD = dur;
			u.ax = (tg.x - u.x) / (d || 1);
			u.ay = (tg.y - u.y) / (d || 1);
			if (u.rng >= 140) Seq.at(dur * 0.4, () => S === "fight" && u.hp > 0 && tg.hp > 0 && (shoot(u, tg, eAtk(u), { el: KIT[u.k] ? KIT[u.k].el : u.el }), sfx("zap", 0.7)));
			else u.sw = { tg, t: dur * 0.42 * SPDX, dmg: eAtk(u) };
		}
	}
}
// удар ближнего боя: у каждого бойца свой росчерк
function strike(u, tg, dmg) {
	if (!tg || tg.hp <= 0) return;
	const mx = (u.x + tg.x) / 2,
		my = (u.y + tg.y) / 2 - 30;
	if (u.k === "frost") Fx.add({ k: "slash", x: mx, y: my, f: u.face, r: 52, c: "#9fe8ff", d: 0.16, w: 8 });
	else if (u.k === "pyro") Fx.add({ k: "slash", x: mx, y: my, f: u.face, r: 52, c: "#ff8a3c", d: 0.16, w: 10 });
	else if (u.k === "golem") { Fx.add({ k: "slash", x: mx, y: my, f: u.face, r: 60, c: "#cfd8dc", d: 0.2, w: 14 }); ring(tg.x, tg.y, 40, "#cfd8dc", 0.25, 3); }
	else if (u.k === "vamp") Fx.add({ k: "slash", x: mx, y: my, f: u.face, r: 52, c: "#e53935", d: 0.16, w: 8 });
	else if (u.k === "shade") { Fx.add({ k: "slash", x: mx, y: my - 6, f: u.face, r: 44, c: "#b2ebf2", d: 0.12, w: 6, rot: -0.5 }); Fx.add({ k: "slash", x: mx, y: my + 8, f: u.face, r: 44, c: "#ffffff", d: 0.14, w: 6, rot: 0.5 }); }
	else if (u.k === "druid") Fx.add({ k: "slash", x: mx, y: my, f: u.face, r: 48, c: "#9ccc65", d: 0.18, w: 10 });
	else if (u.k === "knight") Fx.add({ k: "slash", x: mx, y: my, f: u.face, r: 52, c: "#ffffff", d: 0.16, w: 8 });
	else if (u.k === "paladin") {
		Fx.add({ k: "slash", x: mx, y: my, f: u.face, r: 46, c: "#ffe9a8", d: 0.2, w: 11 });
		ring(tg.x, tg.y, 40, "#ffe9a8", 0.25, 3);
	} else if (u.k === "bandit") {
		Fx.add({ k: "slash", x: mx, y: my - 6, f: u.face, r: 40, c: "#e9d0ff", d: 0.12, w: 5, rot: -0.5 });
		Fx.add({ k: "slash", x: mx, y: my + 8, f: u.face, r: 40, c: "#ffffff", d: 0.14, w: 5, rot: 0.5 });
	} else if (u.team) burst(tg.x - u.face * 10, tg.y - 22, 5, { c: [EL[u.el].c, EL[u.el].c2], sp: 150, s: 6, life: 0.35, ang: u.face > 0 ? 0 : Math.PI, spread: 1.6 });
	hurt(u, tg, dmg, { el: KIT[u.k] ? (u.k === "bandit" ? "phys" : KIT[u.k].el) : u.el, snd: u.team ? "slime" : "hit" });
	if (u.boss) {
		shake(0.22);
		hitProps(tg.x, tg.y, 50, 2);
	}
}
function projStep(h) {
	const A = F.A, projectiles = F.proj, projectileCount = projectiles.length;
	const remaining = projectiles.filter((p) => {
		// Смена фазы босса может очистить очередь прямо при попадании.
		if (F.proj !== projectiles) return false;
		p.life -= h;
		if (p.life <= 0) return false;
		const c = EL[p.el] || EL.phys;
		if (p.tg) {
			if (p.tg.hp <= 0) return false;
			const tx = p.tg.x,
				ty = p.tg.y - (p.tg.rad > 30 ? 60 : 28) - (p.tg.z || 0),
				d = Math.hypot(tx - p.x, ty - p.y);
			if (d < p.sp * h + 12) {
				hurt(p.src, p.tg, p.dmg, { el: p.el, abil: p.o.abil, stc: p.o.stc, quiet: 1 });
				sfx(p.el === "phys" ? "hit" : p.el, 0.6);
				return false;
			}
			p.vx = ((tx - p.x) / d) * p.sp;
			p.vy = ((ty - p.y) / d) * p.sp;
		}
		p.x += p.vx * h;
		p.y += p.vy * h;
		p.tr += h;
		if (p.tr > 0.02) {
			p.tr = 0;
			Parts.add({ x: p.x, y: p.y, vx: rr(-20, 20), vy: rr(-20, 20), life: 0.3, c: Rand.next() < 0.5 ? c.c : c.c2, s: p.o.big ? 6 : 4, k: 0, e: 0.2 });
		}
		if (!p.tg) {
			const gy = p.y + 26;
			if (p.x < FLD.x0 - 30 || p.x > FLD.x1 + 30 || gy < A.y0 - 40 || gy > FLD.y1 + 40) return false;
			for (const o of A.obs)
				if (!o.dead && Math.abs(o.x - p.x) < o.rx && Math.abs(o.y - gy) < o.ry + 8) {
					// камень прикрывает от снарядов
					burst(p.x, p.y, 6, { c: [c.c, c.c2], sp: 140, s: 4, life: 0.3 });
					if (o.hp) hitProps(o.x, o.y, 10, 1);
					return false;
				}
			for (const e of liv(p.team ? F.pl : F.en))
				if (Math.hypot(e.x - p.x, e.y - gy) < p.r + e.rad) {
					hurt(p.src, e, p.dmg, { el: p.el, stc: p.o.stc, quiet: 1 });
					sfx(p.el === "phys" || p.el === "nature" ? "slime" : p.el, 0.6);
					return false;
				}
		}
		return true;
	});
	if (F.proj === projectiles) F.proj = remaining.concat(projectiles.slice(projectileCount));
}
function wxStep(h) {
	const A = F.A,
		q = WX[A.wx] || {};
	if (A.fl > 0) A.fl -= h / SPDX;
	if (F.flux && (F.flux.t -= h) <= 0) F.flux = null;
	A.ev -= h;
	if (A.ev > 0) return;
	const all = liv(F.pl).concat(liv(F.en));
	if (q.bolt) {
		A.ev = rr(4, 6);
		const v = pick(all);
		if (!v) return;
		const x = v.x + rr(-20, 20),
			y = v.y + rr(-10, 10);
		tele({
			x,
			y,
			r: 50,
			d: 1,
			c: "#fff27a",
			fn() {
				A.fl = 0.22;
				Fx.add({ k: "bolt", x0: x + rr(-80, 80), y0: -10, x1: x, y1: y, c: "#ffffff", d: 0.2, w: 5 });
				ring(x, y, 80, "#fff27a", 0.3, 5);
				for (const e of all) if (e.hp > 0 && Math.hypot(e.x - x, (e.y - y) * 1.6) < 50 + e.rad) (hurt(null, e, e.max * (e.boss ? 0.012 : 0.06), { pure: 1, el: "bolt", quiet: 1 }), addSt(e, "shock", 1));
				hitProps(x, y, 40, 3);
				shake(0.2);
				sfx("bolt");
			},
		});
	} else if (q.bomb) {
		A.ev = rr(3.6, 5);
		for (let i = 0; i < 2; i++) {
			const v = pick(all);
			if (!v) return;
			const x = clamp(v.x + rr(-70, 70), FLD.x0, FLD.x1),
				y = clamp(v.y + rr(-30, 30), A.y0, FLD.y1);
			tele({
				x,
				y,
				r: 56,
				d: 1.3,
				c: "#ff8a3c",
				drop: 1,
				fn() {
					ring(x, y, 96, "#ff8a3c", 0.4, 6);
					burst(x, y, 16, { c: ["#ff8a3c", "#ffe27a", "#3a2a2a"], sp: 260, s: 6, life: 0.6, up: 120, fl: y + 4, bn: 0.3 });
					for (const e of all) if (e.hp > 0 && Math.hypot(e.x - x, (e.y - y) * 1.6) < 56 + e.rad) (hurt(null, e, e.max * (e.boss ? 0.012 : 0.07), { pure: 1, el: "fire", quiet: 1 }), addSt(e, "burn", 2, e.max * 0.01));
					hitProps(x, y, 46, 3);
					shake(0.25);
					sfx("boom", 0.7);
				},
			});
		}
	} else if (q.flux) {
		A.ev = 8;
		F.flux = { k: pick(["haste", "might"]), t: 4 };
		Fx.txt(609, 130, F.flux.k === "haste" ? "ПОТОК: все быстрее!" : "ПОТОК: все бьют сильнее!", "#ff9cf0", 24);
		F.fx.push({ k: "flash", t: 0, d: 0.3, c: "#ff4fd8" });
		sfx("dark", 0.6);
	} else {
		A.ev = rr(5, 9);
		if (A.wx === "storm" || A.wx === "rain") A.fl = A.wx === "storm" ? 0.16 : 0;
	}
}
function catStep(sd) {
	const C = F.cat;
	if (!C) return;
	C.t += sd;
	const alive = F.en.filter((e) => e.hp > 0),
		nc = () => EP.map((p, i) => [Math.hypot(p[0] - C.x, p[1] - C.y), i]).sort((u, v) => u[0] - v[0])[0][1],
		mv = (px, py, v) => {
			const dx = px - C.x,
				dy = py - C.y,
				d = Math.hypot(dx, dy) || 1,
				m = Math.min(v * sd, d);
			C.x += (dx / d) * m;
			C.y += (dy / d) * m;
			if (Math.abs(dx) > 2) C.face = dx > 0 ? 1 : -1;
			return d;
		};
	if (C.st === "run") {
		const tg = C.tg && C.tg.hp > 0 ? C.tg : alive[0];
		if (!tg) {
			C.st = "walk";
			C.t = 0;
			C.w = 3;
			C.wi = nc();
		} else {
			C.tg = tg;
			const d = mv(tg.x, tg.y, 900);
			if (Rand.next() < 0.6) Parts.add({ x: C.x, y: C.y - 4, vx: -C.face * 60, vy: -20, life: 0.35, c: "#d7ccc8", s: 4, g: 500 });
			if (d < 34 + (tg.rad || 0)) {
				tg.gate = undefined;
				tg.hp = 0;
				C.st = "dance";
				C.t = 0;
				burst(tg.x, tg.y - 24, 40, { c: "#ffd54f", sp: 320, s: 6, life: 0.6 });
				shake(0.6);
				sfx("boom");
				Fx.txt(Math.max(320, Math.min(900, tg.x)), tg.y - 60, MQ[Math.floor(Rand.next() * MQ.length)], MC[Math.floor(Rand.next() * MC.length)], 22);
				ring(tg.x, tg.y - 24, 90, "#ffd54f", 0.4, 6);
			}
		}
	} else if (C.st === "dance") {
		if (C.t > 1.6) {
			C.st = "walk";
			C.t = 0;
			C.w = 3 + Rand.next() * 3;
			C.wi = nc();
		}
	} else {
		const P = EP[C.wi];
		if (mv(P[0], P[1], 240) < 6) C.wi = (C.wi + 1) % 4;
		if (C.t > C.w && alive.length) {
			C.st = "run";
			C.tg = alive[Math.floor(Rand.next() * alive.length)];
			C.t = 0;
		}
	}
	while (F.fl.length) {
		const f = F.fl.pop();
		Fx.txt(f.x, f.y, f.s, f.c, 22);
	}
}
function deaths() {
	for (const u of [...F.pl, ...F.en]) {
		if (u.hp > 0 || u.dead) continue;
		if (!u.team && F.rb.phx && !F.phx) {
			// перо феникса
			F.phx = 1;
			u.hp = Math.max(1, Math.round(u.max * F.rb.phx));
			u.inv = 1.5;
			u.st = {};
			Fx.add({ k: "pillar", x: u.x, y: u.y, c: "#ff9a3c", w: 70, d: 0.7 });
			burst(u.x, u.y - 30, 24, { c: ["#ff9a3c", "#ffe27a", "#ff4a2a"], sp: 220, s: 6, g: -200, life: 0.9 });
			Fx.txt(u.x, u.y - 100, "Феникс!", "#ffb03c", 22);
			sfx("holy");
			continue;
		}
		u.dead = 1;
		u.hp = 0;
		if (u.skull && !u.team) {
			u.skull = false;
			G.coin += 8;
			Fx.txt(u.x, u.y - 96, "+8", "#ffd600", 22);
			sfx("coin");
		}
		if (!u.team && F.rb.avg) {
			F.avg += F.rb.avg;
			F.pl.forEach((a) => a.hp > 0 && Fx.add({ k: "bubble", u: a, c: "#ff5a4a", d: 0.5 }));
		}
		if (u.team) {
			F.st.kills++;
			if (wxm("soul", 0) && u.lastHit && u.lastHit.hp > 0) heal(u.lastHit, u.lastHit.max * 0.05);
		}
		const c = u.team ? EL[u.el] || EL.phys : { c: "#ffe9a8", c2: "#ffffff" };
		F.dd.push({ u, t: 0, d: u.boss ? 2.6 : 0.9 });
		burst(u.x, u.y - 24, u.boss ? 50 : 16, { c: [c.c, c.c2, "#ffffff"], sp: u.boss ? 380 : 220, s: 6, sv: 0.8, life: 0.8, up: 60, fl: u.y + 6, bn: 0.4 });
		ring(u.x, u.y, u.boss ? 300 : 70, c.c, 0.45, u.boss ? 10 : 4);
		if (!u.team) for (let i = 0; i < 5; i++) Parts.add({ x: u.x + rr(-10, 10), y: u.y - 30, vx: rr(-10, 10), vy: rr(-80, -40), life: 1.2, c: "#cfe8ff", s: 7, k: 1, wob: 30, wf: 4, ph: rr(0, 6) });
		sfx(u.boss ? "bossdie" : "die");
		if (u.boss) {
			shake(0.9);
			slowmo(0.2, 0.9);
			F.fx.push({ k: "flash", t: 0, d: 0.7, c: "#ffffff" });
			for (let i = 1; i < 7; i++)
				Seq.at(i * 0.28, () => {
					const x = u.x + rr(-80, 80),
						y = u.y - rr(10, 110);
					burst(x, y, 14, { c: [c.c, c.c2, "#ffffff"], sp: 260, s: 6, life: 0.6 });
					ring(x, y, 80, "#ffffff", 0.3, 5, 1, 1);
					shake(0.25);
					sfx("boom", 0.6);
				});
			F.en.forEach((e) => {
				if (e !== u) e.hp = 0;
			});
		} else if (u.team && !liv(F.en).length) slowmo(0.3, 0.45); // добивающий удар
		else if (!u.team) shake(0.2);
	}
	F.pl = F.pl.filter((u) => !u.dead);
	F.en = F.en.filter((u) => !u.dead);
}
function simStep(h) {
	const A = F.A,
		hr = h / SPDX;
	for (const d of F.dd) d.t += hr;
	F.dd = F.dd.filter((d) => d.t < d.d);
	for (const o of A.obs) if (o.hitT > 0) o.hitT -= hr;
	A.pools = A.pools.filter((p) => (p.t += h) < p.life);
	if (F.out) {
		F.out.t += hr;
		if (F.out.t >= F.out.d) {
			if (F.out.win) win();
			else lose();
		}
		return;
	}
	if (F.lock > 0) {
		F.lock -= hr;
		for (const u of [...F.pl, ...F.en]) {
			u.hitT = Math.max(0, u.hitT - hr);
			if (u.an && (u.an.t += hr) >= u.an.d) u.an = null;
			if (u.kx || u.ky) {
				u.x += u.kx * h;
				u.y += u.ky * h;
				u.kx *= 0.9;
				u.ky *= 0.9;
				navPush(A, u, u.rad);
			}
		}
		return;
	}
	F.timer -= h;
	F.time += h;
	Seq.clock = F.time;
	catStep(h);
	if (F.lock > 0) return;
	wxStep(h);
	if (F.lock > 0) return;
	const telegraphs = F.tele, telegraphCount = telegraphs.length;
	const pendingTelegraphs = telegraphs.filter((q) => {
		if (F.tele !== telegraphs) return false;
		q.t += h;
		if (q.t >= q.d) {
			if (q.fn) q.fn();
			return false;
		}
		return true;
	});
	// Смена фазы может очистить очередь, а обработчик — добавить новое событие.
	if (F.tele === telegraphs) F.tele = pendingTelegraphs.concat(telegraphs.slice(telegraphCount));
	// Переход фазы останавливает текущий шаг, а не только следующий.
	if (F.lock > 0) return;
	for (const u of [...F.pl, ...F.en]) {
		unitStep(u, h);
		if (F.lock > 0) return;
	}
	projStep(h);
	if (F.lock > 0) return;
	// бойцы не толкают друг друга (без расталкивания, чтобы не заталкивались к краю и могли атаковать)
	const all = liv(F.pl).concat(liv(F.en));
	for (const u of all) if (!u.jump) navPush(A, u, u.rad);
	deaths();
	if (!F.en.length) {
		if (!(F.cat && F.cat.st === "dance" && F.cat.t < 1.6)) {
			F.out = { win: true, t: 0, d: F.kind === "boss" ? 3.1 : 1.5 };
			F.proj = [];
			F.tele = [];
			F.pl.forEach((u) => anim(u, "win", 9, false));
			sfx("win");
		}
	} else if (!F.pl.length || F.timer <= 0) {
		// время вышло: если отряд измотал врагов сильнее, чем они его, бой засчитывается победой
		const frac = (list) => list.reduce((a, u) => a + Math.max(0, u.hp), 0) / Math.max(1, list.reduce((a, u) => a + u.max, 0));
		const byTime = F.timer <= 0 && F.pl.length > 0 && frac(F.pl) > frac(F.en) + 0.05;
		F.out = { win: byTime, t: 0, d: 1.3, time: F.timer <= 0 };
		F.proj = [];
		(byTime ? F.pl : F.en).forEach((u) => anim(u, "win", 9, false));
		if (byTime) sfx("win");
	}
}
function upd(dt) {
	if (S !== "fight" || !F) Seq.clock = null;
	Seq.run();
	if (S !== "fight" || !F) {
		TSC = 1;
		return;
	}
	if (F.slowT > 0) {
		F.slowT -= dt;
		TSC = F.slowS;
	} else TSC = 1;
	let rem = dt * SPDX * TSC,
		n = 0;
	while (rem > 1e-5 && n++ < 16 && S === "fight") {
		const h = Math.min(rem, 0.025);
		simStep(h);
		rem -= h;
	}
}
function spark(x, y, c, n, sp = 120) {
	burst(x, y, n, { c, sp, s: 4, life: 0.5 });
}

