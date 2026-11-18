// ===== 05_err.js =====
// ЖУРНАЛ ОШИБОК И АВАРИЙНЫЙ РЕЖИМ.
// Правило: ошибка внутри кадра не должна останавливать игру. Сбой в update или draw
// ловится по отдельности, пишется в кольцевой журнал, а три подряд идущих сбоя
// переводят игру в безопасный режим с понятным окном вместо мёртвого экрана.
// версия исходников подставляется сборкой (короткий хеш src/ + ассетов)
let GAME_BUILD = "@@BUILD@@";
const ERRS = [];
const ERR_MAX = 200;
// имя экрана для журнала: S объявлена раньше этого файла, но до 12_state.js ещё не задана
const scrName = () => (S ? String(S) : "?");
let ERR_SEQ = 0,
	ERR_STREAK = 0,
	ERR_STREAK_FRAME = -99,
	ERR_CRASH = false,
	FRAME_N = 0;

// ключ API и токены не должны попадать ни в журнал, ни в отчёт
function errRedact(s) {
	return String(s == null ? "" : s)
		.replace(/sk-[A-Za-z0-9_-]{6,}/g, "sk-***")
		.replace(/(["']?(?:key|token|secret|authorization)["']?\s*[:=]\s*)["'][^"']*["']/gi, "$1\"***\"")
		.slice(0, 4000);
}

function logErr(kind, e, extra) {
	const rec = {
		i: ++ERR_SEQ,
		at: new Date().toISOString(),
		frame: FRAME_N,
		screen: scrName(),
		kind: kind,
		msg: errRedact(e && e.message ? e.message : e),
		stack: errRedact(e && e.stack ? String(e.stack).split("\n").slice(0, 6).join("\n") : ""),
		extra: extra ? errRedact(JSON.stringify(extra)) : "",
	};
	ERRS.push(rec);
	if (ERRS.length > ERR_MAX) ERRS.shift();
	try {
		console.error("[game]", kind, rec.msg);
	} catch (_) {}
	if (FRAME_N - ERR_STREAK_FRAME <= 1) ERR_STREAK++;
	else ERR_STREAK = 1;
	ERR_STREAK_FRAME = FRAME_N;
	if (ERR_STREAK >= 3 && !ERR_CRASH) crashScreen(rec);
	return rec;
}
// кадр прошёл без сбоев → серия обнуляется. Зовётся после успешной отрисовки, но если в этом же
// кадре упал update (а draw отработал), кадр не считается живым: иначе сломанная симуляция
// с рабочей отрисовкой никогда не доходила до аварийного окна (нашёл tests/unit/crash.test.mjs).
function errFrameOk() {
	if (ERR_STREAK_FRAME !== FRAME_N) ERR_STREAK = 0;
}

// ---------- аварийное окно ----------
function errReport() {
	const C = typeof CFG === "object" && CFG ? CFG : {};
	const ver = (() => {
		try {
			return window.__mxStorage.getItem("mx_active") || "orig";
		} catch (_) {
			return "?";
		}
	})();
	return JSON.stringify(
		{
			build: typeof GAME_BUILD !== "undefined" ? GAME_BUILD : "",
			version: ver,
			userAgent: navigator && navigator.userAgent,
			screen: scrName(),
			frame: FRAME_N,
			time: Date.now(),
			quality: typeof QL === "object" && QL ? QL.lv : "?",
			cfg: { music: C.music, vol: C.vol, sfx: C.sfx, q: C.q, fps: C.fps },
			screens: typeof Machine === "object" && Machine ? Machine.trail.slice(-16) : [],
			errors: ERRS.slice(-40),
		},
		null,
		1
	);
}

// разметка аварийного окна: заголовок, пояснение, строка ошибки и четыре кнопки
function crashHtml() {
	const bt = (id, label, bg, border = "0") => '<button id="' + id + '" style="flex:1 1 120px;padding:10px;border:' + border + ";border-radius:8px;background:" + bg + ';color:#fff;font-weight:700;cursor:pointer">' + label + "</button>";
	return (
		'<div style="font-weight:800;font-size:17px;margin-bottom:6px">Что-то пошло не так</div>' +
		'<div style="color:#b9b3c8;margin-bottom:12px">Игра поймала сбой три кадра подряд, но не остановилась. Можно продолжить, вернуться в меню или откатить версию кода.</div>' +
		'<div id="mx-crash-msg" style="font:12px/1.4 ui-monospace,monospace;color:#ff9c9c;background:#120e19;border-radius:8px;padding:8px;margin-bottom:12px;word-break:break-word"></div>' +
		'<div style="display:flex;flex-wrap:wrap;gap:8px">' +
		bt("mx-crash-go", "Продолжить", "#2e7d32") +
		bt("mx-crash-menu", "В меню", "#455a64") +
		bt("mx-crash-roll", "Откатить версию", "#8e24aa") +
		bt("mx-crash-copy", "Скопировать отчёт", "#2a2238", "1px solid #555") +
		"</div>"
	);
}
// кнопки окна: «Продолжить» — закрыть и сбросить счётчик сбоев; «В меню» — сбросить бой/событие и уйти в меню
// (переход в меню разрешён из любого экрана, см. Machine.can); «Откатить версию» — #orig и перезагрузка; «Скопировать отчёт»
function crashWire($, wrap) {
	const close = () => {
		try {
			wrap.remove();
		} catch (_) {}
		ERR_CRASH = false;
		ERR_STREAK = 0;
	};
	$("mx-crash-go").onclick = close;
	$("mx-crash-menu").onclick = () => {
		try {
			F = null;
			EV = null;
			pop = null;
			paused = false;
			Machine.go("menu", "аварийное окно");
		} catch (_) {}
		close();
	};
	$("mx-crash-roll").onclick = () => {
		try {
			location.hash = "#orig";
			location.reload();
		} catch (_) {}
	};
	$("mx-crash-copy").onclick = () => {
		const txt = errReport();
		try {
			if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt);
			else {
				const ta = document.createElement("textarea");
				ta.value = txt;
				document.body.appendChild(ta);
				ta.select();
				document.execCommand && document.execCommand("copy");
				ta.remove();
			}
		} catch (_) {}
		$("mx-crash-copy").textContent = "Скопировано";
	};
}
// аварийное окно (DOM поверх холста, см. DECISIONS D7): показывается один раз, пока открыто
function crashScreen(rec) {
	ERR_CRASH = true;
	try {
		if (document.getElementById("mx-crash")) return;
	} catch (_) {}
	const wrap = document.createElement("div");
	wrap.id = "mx-crash";
	wrap.style.cssText =
		"position:fixed;inset:0;z-index:99999;background:rgba(6,4,10,.86);display:flex;align-items:center;justify-content:center;font:14px/1.45 system-ui,sans-serif;color:#eee;padding:16px";
	const box = document.createElement("div");
	box.style.cssText = "max-width:560px;width:100%;background:#1c1626;border:1px solid #8e24aa;border-radius:14px;padding:20px 22px";
	box.innerHTML = crashHtml();
	wrap.appendChild(box);
	try {
		document.body.appendChild(wrap);
	} catch (_) {
		return;
	}
	const $ = (id) => box.querySelector("#" + id);
	try {
		$("mx-crash-msg").textContent = (rec ? rec.kind + ": " + rec.msg : "нет данных") + " · кадр " + FRAME_N + " · экран " + scrName();
	} catch (_) {}
	crashWire($, wrap);
}

// глобальные перехватчики: сюда попадают и сбои вне кадра
// ---------- скрытый экран отладки ----------
// Тройное касание левого нижнего угла (60×60) за 0,9 с включает/выключает панель:
// FPS, время update/draw, объекты и частицы, куча (если браузер даёт), последние ошибки, версия и сборка.
const DBG = { on: false, taps: [], upd: 0, draw: 0, updS: 0, drawS: 0 };
function dbgTap(px, py, now) {
	if (!(px < 60 && py > H - 60)) return false;
	DBG.taps.push(now);
	while (DBG.taps.length && now - DBG.taps[0] > 900) DBG.taps.shift();
	if (DBG.taps.length >= 3) {
		DBG.taps.length = 0;
		DBG.on = !DBG.on;
		return true;
	}
	return false;
}
function dbgMark(kind, ms) {
	// сглаженное время (EMA), чтобы цифры можно было прочитать
	if (kind === "upd") DBG.updS += (ms - DBG.updS) * 0.1;
	else DBG.drawS += (ms - DBG.drawS) * 0.1;
}
function dbgDraw() {
	if (!DBG.on) return;
	const L = [];
	L.push("FPS " + FV + "  кадр " + QL.ft.toFixed(1) + " мс  качество " + QL.lv + (QL.auto ? " (авто)" : "") + "  R=" + R);
	L.push("update " + DBG.updS.toFixed(2) + " мс   draw " + DBG.drawS.toFixed(2) + " мс   шагов/кадр " + Loop.steps + "  alpha " + Loop.alpha.toFixed(2));
	if (F) L.push("бойцы " + F.pl.length + "+" + F.en.length + "  снаряды " + (F.proj ? F.proj.length : 0) + "  эффекты " + F.fx.length + "  числа " + F.nums.length + "  телеграфы " + F.tele.length);
	L.push("частицы " + Parts.a.length + "/" + Parts.cap + "  таймеры " + Timers.count() + "  очередь " + Seq.q.length + "  экран " + S + (paused ? " (пауза)" : "") + "  переходов откл. " + Machine.rejected);
	L.push("цели " + hits.length + "  слои " + Input.layers + "  указатели " + Input.active.size + "  касаний " + Input.taps + "  вторичных " + Input.ignored + "  путь " + Machine.trail.slice(-3).join(" "));
	const mem = typeof performance !== "undefined" && performance.memory,
		cs = cacheStats();
	L.push("кэши: свечение " + cs.glow + "  силуэты " + cs.sil + "  перекраски " + cs.tint + "  пол " + cs.floors + "  растры " + cs.mb.toFixed(1) + " МБ" + (mem ? "  куча " + (mem.usedJSHeapSize / 1048576).toFixed(1) + " / " + (mem.totalJSHeapSize / 1048576).toFixed(1) + " МБ" : ""));
	let ver = "orig";
	try {
		ver = window.__mxStorage.getItem("mx_active") || "orig";
	} catch (_) {}
	L.push("версия кода " + ver + "  сборка " + GAME_BUILD + "  ошибок " + ERRS.length);
	for (const e of ERRS.slice(-3)) L.push("  #" + e.i + " [" + e.kind + "] " + e.msg.slice(0, 90));
	const h = 14 * L.length + 12;
	ctx.save();
	ctx.setTransform(R, 0, 0, R, 0, 0);
	ctx.globalAlpha = 1;
	ctx.fillStyle = "rgba(0,0,0,.72)";
	ctx.fillRect(6, 40, 600, h);
	ctx.font = '11px ui-monospace,Menlo,Consolas,monospace';
	ctx.textAlign = "left";
	ctx.textBaseline = "top";
	L.forEach((s, i) => {
		ctx.fillStyle = i >= L.length - Math.min(3, ERRS.length) && ERRS.length ? "#ff9a9a" : "#c8f0c8";
		ctx.fillText(s, 12, 46 + i * 14);
	});
	ctx.restore();
}
function errInstallGlobals() {
	try {
		addEventListener("error", (e) => {
			if (e && (e.error || e.message)) logErr("window.error", e.error || e.message);
		});
		addEventListener("unhandledrejection", (e) => logErr("promise", (e && e.reason) || "rejection"));
	} catch (_) {}
}
