// ===== 90_boot.js =====
// ===== ЗАПУСК: масштаб экрана, цикл кадра, ввод =====
let pz = false,
	last = 0,
	FC = 0,
	FT = 0,
	FV = 0,
	fsTry = false;
function fit() {
	const w = innerWidth,
		h = innerHeight;
	hiDpi();
	cv.style.cssText = (h > w ? `position:fixed;left:${w}px;top:0;width:${h}px;height:${w}px;transform-origin:0 0;transform:rotate(90deg)` : `position:fixed;left:0;top:0;width:${w}px;height:${h}px`) + ";image-rendering:" + (R === 1 ? "pixelated" : "auto");
}
// внутреннее разрешение: x2 на больших экранах; на низком качестве — x1 (вчетверо меньше пикселей)
function hiDpi() {
	const want = Math.max(1, Math.min(2, Math.round((Math.max(innerWidth, innerHeight) * (window.devicePixelRatio || 1)) / W))),
		r = QL.lv === 0 ? 1 : want;
	if (r !== R || cv.width !== W * r) {
		R = r;
		cv.width = W * R;
		cv.height = H * R;
		ctx.imageSmoothingEnabled = false;
		cv.style.imageRendering = R === 1 ? "pixelated" : "auto";
	}
}
function unlock() {
	Music.wake();
	if (fsTry) return;
	fsTry = true;
	const el = document.documentElement;
	try {
		const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: "hide" }) : el.webkitRequestFullscreen && el.webkitRequestFullscreen();
		if (p && p.catch) p.catch(() => {});
	} catch (_) {}
	try {
		screen.orientation.lock("landscape").catch(() => {});
	} catch (_) {}
	fit();
}
function loop(ts) {
	FRAME_N++;
	FC++;
	if (ts - FT >= 500) {
		FV = Math.round((FC * 1000) / (ts - FT));
		FC = 0;
		FT = ts;
	}
	const raw = ts - last,
		dt = Math.min(0.05, Math.max(0, raw / 1000));
	last = ts;
	if (READY && G) {
		if (raw < 250) perfTick(raw);
		t += dt;
		DT = paused ? 0 : dt;
		SK = Math.max(0, SK - dt * 1.5);
		if (TRT > 0) TRT -= dt;
		if (paused !== pz) {
			pz = paused;
			Music.pause(paused);
			// после паузы накопленное время не должно превратиться в рывок симуляции
			Loop.reset();
		}
		Music.level(S === "fight" ? 1 : 0);
		Tune.upd();
		if (!paused) {
			// сбой в симуляции не должен дотянуться до отрисовки и цикла
			try {
				// симуляция — фиксированным шагом 1/60 с (накопитель, не более Loop.MAX шагов за кадр)
				const steps = Loop.feed(raw / 1000),
					t0 = performance.now();
				for (let i = 0; i < steps; i++) Machine.update(Loop.STEP);
				dbgMark("upd", performance.now() - t0);
				flowTick();
				visTick(dt);
				// атмосфера вне боя
				if (S === "map" || S === "msg" || S === "world" || S === "shop") {
					MAPA.w = WORLDS[S === "world" ? Math.min(WORLDS.length - 1, G.w + 1) : G.w || 0];
					if (!(S === "msg" && EV && EV.bg)) wxEmit(MAPA, dt, S === "shop" ? 0.5 : 0.7);
				} else if (S === "menu" || S === "pick" || S === "settings") {
					MAPA.w = WORLDS[0];
					wxEmit(MAPA, dt, 2.2);
				}
			} catch (e) {
				logErr("update", e);
			}
		}
	}
	// фон карты собирается порциями между симуляцией и отрисовкой (см. bakeMap)
	if (MAPJ && READY && G) {
		try {
			bakeStep(BAKE_MS);
		} catch (e) {
			MAPJ = null;
			logErr("update", e);
		}
	}
	try {
		const t1 = performance.now();
		draw();
		dbgMark("draw", performance.now() - t1);
		dbgDraw();
		errFrameOk();
	} catch (e) {
		logErr("draw", e);
	}
	requestAnimationFrame(loop);
}
// касания, клавиатура и отмена указателей — в Input (13_input.js)
Input.install(cv);
addEventListener("resize", fit);
addEventListener("orientationchange", () => Timers.after(150, fit, "boot"));
document.addEventListener("visibilitychange", () => {
	Music.pause(document.hidden || paused);
	// свёрнутая вкладка: время не копится, бой встаёт на паузу — без скачка после возврата
	if (document.hidden) {
		Loop.reset();
		Input.reset();
		if (S === "fight" || S === "prep") paused = true;
	}
});
["pointerdown", "touchstart", "keydown"].forEach((ev2) => addEventListener(ev2, unlock, { passive: true }));
errInstallGlobals();
if (CFG.q === undefined) CFG.q = "auto";
setQ(CFG.q);
fit();
Light.init();
Music.cfg(CFG.music, CFG.vol);
Music.start();
sfxBank();
Music.sfxv = CFG.sfx === undefined ? 1 : CFG.sfx;
Timers.every(1000, () => Music.wake(), "audio");
// Сид случайности: в браузере партии не должны повторяться, поэтому берём время.
// Тесты выставляют сид сами: Rand.seed(N) сразу после загрузки (см. tests/harness).
Rand.seed((Date.now() ^ ((performance.now() * 1000) | 0)) >>> 0);
requestAnimationFrame(loop);
loadAll().then(() => {
	newGame();
	Machine.go("menu");
});