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
		get randState() {
			return Rand.state;
		},
		snapshot: snap,
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
