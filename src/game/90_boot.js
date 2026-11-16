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
function loop(ts) {
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
		}
		Music.level(S === "fight" ? 1 : 0);
		Tune.upd();
		if (!paused) {
			upd(dt);
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
		}
	}
	draw();
	requestAnimationFrame(loop);
}
cv.addEventListener("pointerdown", (e) => {
	if (!READY) return;
	const [px, py] = lp(e);
	for (let i = hits.length - 1; i >= 0; i--) {
		const h = hits[i];
		if (px >= h.x && px <= h.x + h.w && py >= h.y && py <= h.y + h.h) {
			Music.sfx("click");
			h.f(px, py);
			break;
		}
	}
});
addEventListener("keydown", (e) => {
	if (document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
	if (!READY || e.repeat) return;
	const k = e.key;
	if (k === "Escape" && S === "codex" && CODEX_TEST) { CODEX_TEST = null; pop = null; e.preventDefault(); return; }
	if (k === "Escape" || k === "p" || k === "P" || k === "з" || k === "З") {
		if (S !== "menu" && S !== "settings" && S !== "win" && S !== "lose") paused = !paused;
	} else if (paused) return;
	else if (k === " " || k === "Enter") {
		if (S === "prep" && G.slots.some((u) => u && u.placed)) startFight();
		else if (S === "prep") autoPlace();
		else if (S === "msg" && EV) {
			const e2 = EV;
			if (!e2.open) {
				e2.open = 1;
				e2.to = t;
				sfx("chest");
			} else if (!e2.pick) evClose();
		}
		e.preventDefault();
	} else if (S === "fight" && (k === "1" || k === "2" || k === "3")) SPDX = +k;
});
addEventListener("resize", fit);
addEventListener("orientationchange", () => setTimeout(fit, 150));
document.addEventListener("visibilitychange", () => Music.pause(document.hidden || paused));
["pointerdown", "touchstart", "keydown"].forEach((ev2) => addEventListener(ev2, unlock, { passive: true }));
if (CFG.q === undefined) CFG.q = "auto";
setQ(CFG.q);
fit();
Light.init();
Music.cfg(CFG.music, CFG.vol);
Music.start();
sfxBank();
Music.sfxv = CFG.sfx === undefined ? 1 : CFG.sfx;
setInterval(() => Music.wake(), 1000);
// Сид случайности: в браузере партии не должны повторяться, поэтому берём время.
// Тесты выставляют сид сами: Rand.seed(N) сразу после загрузки (см. tests/harness).
Rand.seed((Date.now() ^ ((performance.now() * 1000) | 0)) >>> 0);
requestAnimationFrame(loop);
loadAll().then(() => {
	newGame();
	S = "menu";
});