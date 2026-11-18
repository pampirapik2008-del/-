// ===== 13_input.js =====
// ===== ВВОД: слои касаний, указатели, клавиатура, поворот экрана =====
// Экран каждый кадр заново объявляет свои цели касания (area/btn/ibtn → массив hits).
// Касание получает самая верхняя цель (последняя объявленная). Модальный слой
// (Input.layer) отбрасывает всё, что объявлено до него: карта под окном события,
// пауза поверх боя и т.п. не получают ввод. Массив hits остаётся как совместимый
// алиас Input.hits для обвязки тестов и редактора.
const Input = {
	get hits() {
		return hits;
	},
	layers: 0, // сколько модальных слоёв объявлено в текущем кадре
	active: new Map(), // id указателя → { x, y, t } — удержанные пальцы/кнопки
	taps: 0, // принятых касаний за сессию (экран отладки)
	ignored: 0, // отброшенных вторичных касаний (мультитач)
	// новый кадр: цели прошлого кадра забываются
	begin() {
		hits.length = 0;
		this.layers = 0;
	},
	// модальный слой: цели, объявленные раньше, недостижимы
	layer() {
		hits.length = 0;
		this.layers++;
	},
	// верхняя цель под точкой или null
	pick(px, py) {
		for (let i = hits.length - 1; i >= 0; i--) {
			const h = hits[i];
			if (px >= h.x && px <= h.x + h.w && py >= h.y && py <= h.y + h.h) return h;
		}
		return null;
	},
	// касание/клик. Вторичные указатели (второй палец при удержанном первом) не считаются
	// нажатием: иначе два пальца = две покупки/два хода.
	down(e) {
		if (!READY) return;
		if (e.isPrimary === false) {
			this.ignored++;
			return;
		}
		const [px, py] = lp(e);
		const id = e.pointerId === undefined ? 0 : e.pointerId;
		this.active.set(id, { x: px, y: py, t: performance.now() });
		if (dbgTap(px, py, performance.now())) return;
		const h = this.pick(px, py);
		if (!h) return;
		this.taps++;
		Music.sfx("click");
		h.f(px, py);
	},
	// палец убран или касание отменено системой (жест, звонок, сворачивание)
	release(e) {
		this.active.delete(e && e.pointerId !== undefined ? e.pointerId : 0);
	},
	reset() {
		this.active.clear();
	},
	// клавиатура (ПК): пауза, старт/подтверждение, скорость боя
	key(e) {
		if (document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
		if (!READY || e.repeat) return;
		const k = e.key;
		if (k === "Escape" && Machine.is("codex") && CODEX_TEST) {
			CODEX_TEST = null;
			pop = null;
			e.preventDefault();
			return;
		}
		if (k === "Escape" || k === "p" || k === "P" || k === "з" || k === "З") {
			if (Machine.flag("pausable") !== false) paused = !paused;
		} else if (paused) return;
		else if (k === " " || k === "Enter") {
			if (Machine.is("prep") && G.slots.some((u) => u && u.placed)) startFight();
			else if (Machine.is("prep")) autoPlace();
			else if (Machine.is("msg") && EV) {
				const e2 = EV;
				if (!e2.open) {
					e2.open = 1;
					e2.to = t;
					sfx("chest");
				} else if (!e2.pick) evClose();
			}
			e.preventDefault();
		} else if (Machine.is("fight") && (k === "1" || k === "2" || k === "3")) SPDX = +k;
	},
	// подписка на события холста и окна (вызывается при запуске)
	install(canvas) {
		canvas.addEventListener("pointerdown", (e) => this.down(e));
		canvas.addEventListener("pointerup", (e) => this.release(e));
		canvas.addEventListener("pointercancel", (e) => this.release(e));
		canvas.addEventListener("lostpointercapture", (e) => this.release(e));
		addEventListener("keydown", (e) => this.key(e));
	},
};
// координаты события → логические координаты холста 1218x540 с учётом letterbox-полей
// и поворота на 90° в портретной ориентации (холст развёрнут CSS-трансформом в fit()).
function lp(e) {
	const w = innerWidth,
		h = innerHeight,
		po = h > w,
		bw = po ? h : w,
		bh = po ? w : h,
		lx = po ? e.clientY : e.clientX,
		ly = po ? w - e.clientX : e.clientY,
		s = Math.min(bw / W, bh / H);
	return [(lx - (bw - W * s) / 2) / s, (ly - (bh - H * s) / 2) / s];
}
