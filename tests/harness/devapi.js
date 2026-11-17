// Отладочный доступ к внутренностям игры. Подключается ТОЛЬКО тестовой обвязкой
// (в собранный index.html этот файл не попадает).
;globalThis.__dev = (() => {
	const r1 = (v) => (typeof v === "number" && isFinite(v) ? Math.round(v * 10) / 10 : String(v));
	const snap = () => {
		const out = [];
		out.push("S=" + S, "t=" + Math.floor(t * 10));
		if (G) {
			out.push("g=" + [G.coin, G.meat, G.w, G.cur, G.depth, G.vis ? G.vis.size : 0, G.rel ? G.rel.length : 0].join(","));
			if (G.slots)
				out.push("sl=" + G.slots.map((u) => (u ? [u.k, u.lv, Math.round(u.hp), Math.round(u.atk), u.placed ? 1 : 0].join(":") : "-")).join(";"));
			if (G.st) out.push("st=" + [G.st.fights, G.st.kills, G.st.dmg].join(","));
		}
		if (N) out.push("N=" + N.length, "E=" + (E ? E.length : 0));
		if (F) {
			out.push("F=" + [F.kind, F.w, r1(F.timer), F.out ? (F.out.win ? "W" : "L") + r1(F.out.t) : "-"].join(","));
			out.push(
				"u=" +
					(F.pl || [])
						.concat(F.en || [])
						.map((u) => [u.k, r1(u.x), r1(u.y), Math.round(u.hp), Math.round(u.max)].join(":"))
						.join(";")
			);
			out.push("fs=" + [F.st.dmg, F.st.taken, F.st.kills, F.st.crits].join(","));
		}
		return out.join("|");
	};
	return {
		get S() {
			return S;
		},
		set S(v) {
			S = v;
		},
		get G() {
			return G;
		},
		get F() {
			return F;
		},
		get N() {
			return N;
		},
		get E() {
			return E;
		},
		get hits() {
			return hits;
		},
		// подписи кнопок: после включения каждый hit от btn() получает поле label,
		// и по экрану можно ходить по тексту кнопки, а не по индексу
		labelButtons() {
			if (this._labeled) return;
			this._labeled = true;
			const orig = btn;
			btn = function (x, y, w, h, s) {
				const n = hits.length,
					r = orig.apply(this, arguments);
				if (hits.length > n) hits[hits.length - 1].label = String(s);
				return r;
			};
		},
		findHit(label) {
			return (hits || []).find((h) => h.label && h.label.indexOf(label) >= 0) || null;
		},
		get paused() {
			return paused;
		},
		set paused(v) {
			paused = v;
		},
		get t() {
			return t;
		},
		get PK() {
			return PK;
		},
		set PK(v) {
			PK = v;
		},
		get pop() {
			return pop;
		},
		set pop(v) {
			pop = v;
		},
		get SD() {
			return typeof SD !== "undefined" ? SD : null;
		},
		seed(v) {
			Rand.seed(v);
		},
		// выполнить выражение в глобальной области игры (только для тестов)
		run(code) {
			return (0, eval)(code);
		},
		get randState() {
			return Rand.state;
		},
		snapshot: snap,
		// размеры внутренних кэшей и пулов — для контроля утечек
		mem() {
			const cnt = (o) => (o && typeof o === "object" ? Object.keys(o).length : 0);
			return {
				glow: cnt(typeof GLOWC !== "undefined" ? GLOWC : null),
				sil: typeof SILC !== "undefined" && SILC ? SILC.size : 0,
				tint: cnt(typeof TINTC !== "undefined" ? TINTC : null),
				recol: typeof RECOL !== "undefined" && RECOL && RECOL.size ? RECOL.size : 0,
				fx: F && F.fx ? F.fx.length : 0,
				nums: F && F.nums ? F.nums.length : 0,
				proj: F && F.proj ? F.proj.length : 0,
				parts: typeof Parts !== "undefined" && Parts && Parts.list ? Parts.list.length : -1,
				errs: ERRS.length,
			};
		},
		// замер времени симуляции и отрисовки (только для тестов производительности)
		_timers: { upd: 0, draw: 0, n: 0 },
		instrument(on = true) {
			if (!on || this._wrapped) return;
			this._wrapped = true;
			const ACC = this._timers,
				now = __hrnow,
				mu = Machine.update,
				d = draw;
			// симуляцию зовёт Machine.update (экран fight держит ссылку на upd с момента регистрации,
			// поэтому подмена самой переменной upd до цикла не дотянулась бы)
			Machine.update = function () {
				const t0 = now();
				try {
					return mu.apply(Machine, arguments);
				} finally {
					ACC.upd += now() - t0;
				}
			};
			draw = function () {
				const t0 = now();
				try {
					return d.apply(this, arguments);
				} finally {
					ACC.draw += now() - t0;
					ACC.n++;
				}
			};
		},
		get timers() {
			return this._timers;
		},
		// журнал ошибок и аварийный режим
		errs: () => ERRS.map((r) => ({ kind: r.kind, msg: r.msg, frame: r.frame, screen: r.screen, stack: r.stack })),
		crash: () => ERR_CRASH,
		makeDrawThrow(n = 1) {
			const orig = draw;
			draw = function () {
				if (n > 0) {
					n--;
					throw new Error("тестовая ошибка draw");
				}
				return orig.apply(this, arguments);
			};
		},
		makeUpdateThrow(n = 1) {
			// цикл кадра зовёт Machine.update → хук update текущего экрана
			const orig = Machine.update;
			Machine.update = function () {
				if (n > 0) {
					n--;
					throw new Error("тестовая ошибка update");
				}
				return orig.apply(this, arguments);
			};
		},
		newGame,
		genMap,
		bakeMap,
		startRun,
		fight,
		startFight,
		autoPlace,
		openShop,
		buy,
		evClose,
		saveGame,
		delSave,
		loadGame,
		autosave,
		toast,
		avail,
		go,
		recruit: (h) => recruit(h, 0),
		HEROES,
		WORLDS,
		setSlot(i, h) {
			G.slots[i] = h ? recruit(h, 0) : null;
		},
		setWorld(w, depth) {
			G.w = w;
			G.depth = depth === undefined ? G.depth : depth;
		},
	};
})();
