// ===== 63_perf_report.js =====
// Добровольный замер: интервалы RAF включают ожидание браузера и растеризацию, а не только JS.
let PERF_REPORT = null;
const PERF_REPORT_MS = 20000;

// Медиана с линейной интерполяцией; p95 — ближайший ранг (не сглаживает редкие пики).
function perfReportMedian(values) {
	if (!values.length) return 0;
	const a = values.slice().sort((x, y) => x - y), m = (a.length - 1) / 2;
	return (a[Math.floor(m)] + a[Math.ceil(m)]) / 2;
}
function perfReportP95(values) {
	if (!values.length) return 0;
	const a = values.slice().sort((x, y) => x - y);
	return a[Math.ceil(a.length * 0.95) - 1];
}
function perfReportStats(frames, updates, draws) {
	const median = perfReportMedian(frames), p95 = perfReportP95(frames), n = frames.length;
	return {
		fps: median > 0 ? 1000 / median : 0,
		worstFps: p95 > 0 ? 1000 / p95 : 0,
		update: perfReportMedian(updates), update95: perfReportP95(updates),
		draw: perfReportMedian(draws), draw95: perfReportP95(draws),
		slow16: n ? 100 * frames.filter((x) => x > 16.7).length / n : 0,
		slow33: n ? 100 * frames.filter((x) => x > 33).length / n : 0,
	};
}
function perfReportStart() {
	if (PERF_REPORT) return toast("Замер уже идёт — вернитесь в игру");
	PERF_REPORT = { start: performance.now(), prev: null, frames: [], updates: [], draws: [], contexts: new Set() };
	toast("Замер 20 секунд: вернитесь в игру");
}
function perfReportContext() {
	const world = G && WORLDS[G.w];
	return "экран " + S + ", мир " + (world ? world.n + " (" + G.w + ")" : "нет") +
		", качество " + QL.lv + (QL.auto ? " (авто)" : " (ручное)") +
		", DPR " + (window.devicePixelRatio || 1) + ", окно " + innerWidth + "×" + innerHeight + ", R " + R;
}
function perfReportFrame(ts, update, drawMs) {
	const p = PERF_REPORT;
	if (!p) return;
	if (p.prev !== null && ts > p.prev) p.frames.push(ts - p.prev);
	p.prev = ts;
	p.updates.push(update);
	p.draws.push(drawMs);
	p.contexts.add(perfReportContext());
	if (ts - p.start < PERF_REPORT_MS) return;
	PERF_REPORT = null;
	perfReportDialog(perfReportText(p));
}
function perfReportText(p) {
	const s = perfReportStats(p.frames, p.updates, p.draws), f = (x) => x.toFixed(2);
	return [
		"Отчёт о производительности «Пробуждение монстров»",
		"Длительность: " + f((p.prev - p.start) / 1000) + " с; интервалы кадров: " + p.frames.length,
		"FPS: медиана " + f(s.fps) + "; худшие 5% (1000 / p95 кадра) " + f(s.worstFps),
		"Update: медиана " + f(s.update) + " мс; p95 " + f(s.update95) + " мс",
		"Draw: медиана " + f(s.draw) + " мс; p95 " + f(s.draw95) + " мс",
		"Кадры > 16,7 мс: " + f(s.slow16) + "%; > 33 мс: " + f(s.slow33) + "%",
		"Условия за время замера:", ...p.contexts,
		"User-Agent: " + (navigator.userAgent || "неизвестно"),
	].join("\n");
}
// Текст задаётся через value, а не HTML: userAgent и названия не превращаются в разметку.
function perfReportDialog(text) {
	const old = document.getElementById("mx-perf");
	if (old) old.remove();
	const wrap = document.createElement("div"), box = document.createElement("div");
	wrap.id = "mx-perf";
	wrap.style.cssText = "position:fixed;inset:0;z-index:99998;background:rgba(6,4,10,.8);display:flex;align-items:center;justify-content:center;font:14px/1.45 system-ui,sans-serif;color:#eee;padding:16px";
	box.style.cssText = "max-width:560px;width:100%;background:#1c1626;border:1px solid #8e24aa;border-radius:14px;padding:18px 20px";
	box.innerHTML = '<div style="font-weight:800;font-size:17px;margin-bottom:6px">Отчёт о производительности</div>' +
		'<div style="color:#b9b3c8;margin-bottom:10px">Отчёт содержит сведения об устройстве и браузере. Скопируйте его вручную, если кнопка недоступна.</div>' +
		'<textarea id="mx-perf-text" readonly style="width:100%;height:200px;box-sizing:border-box;background:#120e19;color:#d9d2e8;padding:8px"></textarea>' +
		'<div id="mx-perf-msg" style="min-height:20px;margin:8px 0"></div>' +
		'<div style="display:flex;gap:8px"><button id="mx-perf-copy" style="flex:1;padding:10px">Копировать</button><button id="mx-perf-close" style="flex:1;padding:10px">Закрыть</button></div>';
	wrap.appendChild(box);
	document.body.appendChild(wrap);
	const $ = (id) => box.querySelector("#" + id), ta = $("mx-perf-text"), msg = $("mx-perf-msg");
	ta.value = text;
	$("mx-perf-close").onclick = () => wrap.remove();
	$("mx-perf-copy").onclick = () => {
		ta.focus(); ta.select();
		const done = () => { msg.textContent = "Скопировано."; };
		const fail = () => { msg.textContent = "Выделите текст и скопируйте вручную."; };
		try {
			if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fail);
			else if (document.execCommand && document.execCommand("copy")) done();
			else fail();
		} catch (_) { fail(); }
	};
	return wrap;
}
