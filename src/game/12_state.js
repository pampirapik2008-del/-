// ===== 12_state.js =====
// ===== МАШИНА ЭКРАНОВ: таблица переходов, enter/update/draw/exit =====
// Правила:
//  - экран переключается только через Machine.go(name); переход, которого нет в таблице,
//    пишется в журнал ошибок и отклоняется (S не меняется, функция возвращает false);
//  - строка S остаётся совместимым алиасом текущего экрана (её читают 70+ мест кода
//    и редактор); вход/выход экрана фиксируются лениво, в начале кадра (Machine.sync),
//    поэтому даже прямое присваивание S = "…" из старого кода или правки ИИ получает
//    те же enter/exit, что и переход через go();
//  - при выходе с экрана снимаются таймеры и слушатели, принадлежащие ему
//    (Timers.after/every/on с owner "screen:<имя>").
const SCREEN_NAMES = ["menu", "pick", "map", "prep", "fight", "msg", "shop", "settings", "world", "codex", "win", "lose"];
// Откуда → куда. «menu» разрешён отовсюду (пауза → «В меню», аварийное окно), переход
// экрана в самого себя — тоже (цепочки событий msg → msg, старт игры menu → menu).
const TRANS = {
	menu: ["pick", "map", "prep", "codex", "settings"], // новая игра / продолжить / арена / коллекция / настройки
	pick: ["map", "settings"], // «В поход!» / пауза → настройки
	map: ["prep", "msg", "shop", "settings"], // узел боя / событие / лавка / пауза
	prep: ["fight", "settings"], // «В бой!» / пауза
	fight: ["msg", "lose", "settings"], // награда / поражение / пауза
	msg: ["map", "prep", "shop", "win", "world", "settings"], // «В путь» / следующая волна арены / лавка арены / финал / новый мир
	shop: ["map", "prep", "settings"], // «В путь» / «Следующая волна» (арена)
	settings: SCREEN_NAMES.slice(), // назад на экран, с которого открыли (SRET)
	world: ["map", "settings"], // «В путь!» в следующий мир
	codex: ["settings"], // только назад в меню и пауза
	win: ["pick", "prep"], // «Новый поход» / «Ещё раз» (арена)
	lose: ["pick", "prep"],
};
const Machine = {
	def: {}, // имя экрана → { scene, enter(from), update(dt), draw(), exit(to) }
	prev: "", // предыдущий экран (после sync)
	trail: [], // последние переходы — попадают в аварийный отчёт
	TRAIL_MAX: 32,
	rejected: 0, // счётчик отклонённых переходов (виден на экране отладки)
	reg(name, hooks) {
		this.def[name] = Object.assign({ scene: name }, this.def[name] || {}, hooks);
	},
	scene(name) {
		const d = this.def[name];
		return d ? d.scene : undefined;
	},
	can(from, to) {
		if (to === from || to === "menu") return SCREEN_NAMES.indexOf(to) >= 0;
		const row = TRANS[from];
		return !!row && row.indexOf(to) >= 0;
	},
	// единственная точка смены экрана
	go(to, why) {
		const from = S;
		if (!this.can(from, to)) {
			this.rejected++;
			logErr("state", new Error("переход " + from + " → " + to + " запрещён таблицей" + (why ? " (" + why + ")" : "")), { from, to });
			return false;
		}
		if (to !== from) {
			this.trail.push(from + ">" + to + "@" + FRAME_N);
			if (this.trail.length > this.TRAIL_MAX) this.trail.shift();
		}
		S = to;
		return true;
	},
	// ленивая фиксация смены экрана — вызывается в начале каждого кадра отрисовки
	sync() {
		if (S === lastS) return;
		const from = lastS,
			to = S,
			df = this.def[from],
			dt = this.def[to];
		if (df && df.exit) df.exit(to);
		Timers.clearOwner("screen:" + from);
		if (this.scene(to) !== this.scene(from)) {
			Parts.clear();
			TRT = 0.42;
			CAM.z = 1;
		}
		if (dt && dt.enter) dt.enter(from);
		if (to !== "prep" && to !== "fight" && to !== "shop" && to !== "map") pop = null;
		if (from === "fight" || from === "prep") pop = null;
		TIPN = TIPR = null;
		this.prev = from;
		lastS = to;
	},
	update(dt) {
		const d = this.def[S];
		if (d && d.update) d.update(dt);
		else idleUpd(dt);
	},
	drawScreen() {
		const d = this.def[S] || this.def.lose;
		d.draw();
	},
};
