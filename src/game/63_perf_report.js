// ===== 63_perf_report.js =====
// Добровольный замер: интервалы RAF включают ожидание браузера и растеризацию, а не только JS.
let PERF_REPORT = null;
const PERF_REPORT_MS = 120000;

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
	PERF_REPORT = { start: performance.now(), prev: null, samples: [] };
	toast("Замер 2 минуты: вернитесь в игру");
}
function perfReportContext() {
	const world = G && WORLDS[G.w];
	return "экран " + S + ", мир " + (world ? world.n + " (" + G.w + ")" : "нет") +
		(G ? ", узел " + G.cur + ", глубина " + G.depth : "") + ", качество " + QL.lv + (QL.auto ? " (авто)" : " (ручное)") +
		", DPR " + (window.devicePixelRatio || 1) + ", окно " + innerWidth + "×" + innerHeight + ", R " + R;
}
// Признаки совпадения по времени, а не диагноз причины просадки.
function perfReportActivity() {
	const a = [];
	if (MAPJ) a.push("сборка карты: " + (MAPJ.py < 270 ? "земля" : ["озёра", "дороги", "лес: выбор", "лес: отрисовка", "готово"][MAPJ.stage] || "декор"));
	if (paused) a.push("пауза");
	if (TRT > 0) a.push("переход экрана");
	if (Machine.is("msg") && EV) a.push("событие: " + (EV.title || "без названия") + (EV.chest === undefined ? "" : EV.open ? ", сундук открыт" : ", сундук закрыт"));
	if (Machine.is("prep", "fight") && F) {
		a.push("бой: " + F.kind);
		if (F.out) a.push(F.out.win ? "плашка победы" : F.out.time ? "время вышло" : "поражение");
		for (const f of F.fx) if (f.k === "cut" || f.k === "banner" || f.k === "go" || f.k === "flash") a.push(({ cut: "способность", banner: "баннер", go: "начало боя", flash: "вспышка" })[f.k] + (f.s ? ": " + f.s : ""));
	}
	return [...new Set(a)].join("; ") || "обычный кадр";
}
function perfReportSnapshot(ts, update, drawMs) {
	const fight = Machine.is("prep", "fight") && F;
	return { ts, update, draw: drawMs, context: perfReportContext(), activity: perfReportActivity(), particles: Parts.a.length,
		effects: fight ? F.fx.length : 0, projectiles: fight ? F.proj.length : 0, units: fight ? F.pl.length + F.en.length : 0 };
}
// Интервал относится к предыдущему кадру; следующий экран сохраняется, чтобы видеть переходы и блокировки между RAF.
function perfReportFrame(ts, update, drawMs) {
	const p = PERF_REPORT;
	if (!p) return;
	const now = perfReportSnapshot(ts, update, drawMs);
	if (p.prev && ts > p.prev.ts) p.samples.push({ ...p.prev, frame: ts - p.prev.ts, next: now.context, nextActivity: now.activity });
	p.prev = now;
	if (ts - p.start < PERF_REPORT_MS) return;
	PERF_REPORT = null;
	perfReportDialog(perfReportText(p));
}
function perfReportSummary(samples) {
	const s = perfReportStats(samples.map((x) => x.frame), samples.map((x) => x.update), samples.map((x) => x.draw));
	const f = (x) => x.toFixed(2), total = samples.reduce((sum, x) => sum + x.frame, 0);
	return "кадров " + samples.length + "; FPS средний " + f(total ? 1000 * samples.length / total : 0) + ", медиана " + f(s.fps) + ", худшие 5% " + f(s.worstFps) +
		"; update медиана/p95 " + f(s.update) + "/" + f(s.update95) + " мс; draw " + f(s.draw) + "/" + f(s.draw95) +
		" мс; >16,7 мс " + f(s.slow16) + "%, >33 мс " + f(s.slow33) + "%";
}
function perfReportGroups(samples, key) {
	const groups = new Map();
	for (const sample of samples) {
		const k = key(sample);
		if (!groups.has(k)) groups.set(k, []);
		groups.get(k).push(sample);
	}
	return groups;
}
function perfReportTimeline(p) {
	const seconds = perfReportGroups(p.samples, (s) => Math.floor((s.ts - p.start) / 1000));
	const lines = [];
	for (const [sec, samples] of seconds) {
		for (const [context, group] of perfReportGroups(samples, (s) => s.context)) {
			const activities = [...new Set(group.map((s) => s.activity))];
			const peak = Math.max(...group.map((s) => s.particles)), fx = Math.max(...group.map((s) => s.effects)),
				proj = Math.max(...group.map((s) => s.projectiles)), units = Math.max(...group.map((s) => s.units));
			lines.push("[" + sec + "–" + (sec + 1) + " с] " + context + " | " + perfReportSummary(group) +
				"; худший кадр " + Math.max(...group.map((s) => s.frame)).toFixed(2) + " мс; частиц до " + peak + ", эффектов до " + fx + ", снарядов до " + proj + ", бойцов до " + units + " | " + activities.join("; "));
		}
	}
	return lines;
}
function perfReportWorst(p) {
	return p.samples.slice().sort((a, b) => b.frame - a.frame).slice(0, 20).map((s) =>
		"[" + ((s.ts - p.start) / 1000).toFixed(3) + " с] " + s.frame.toFixed(2) + " мс (" + (1000 / s.frame).toFixed(2) + " FPS); update " + s.update.toFixed(2) +
		" мс, draw " + s.draw.toFixed(2) + " мс; " + s.context + (s.next !== s.context ? " → " + s.next : "") + "; " + s.activity + (s.nextActivity !== s.activity ? " → " + s.nextActivity : "") + "; частиц " + s.particles + ", эффектов " + s.effects + ", снарядов " + s.projectiles + ", бойцов " + s.units);
}
function perfReportText(p) {
	const locations = perfReportGroups(p.samples, (s) => s.context), timeline = perfReportTimeline(p), worst = perfReportWorst(p);
	return [
		"Отчёт о производительности «Пробуждение монстров»",
		"Длительность: " + ((p.prev.ts - p.start) / 1000).toFixed(2) + " с; " + perfReportSummary(p.samples),
		"Средний FPS = число кадров / сумма интервалов; медиана FPS = 1000 / медиана интервала RAF; худшие 5% = 1000 / p95 интервала. Метрики update/draw — время главного потока, не время GPU.",
		"Интервал относится к предыдущему кадру; задержка между кадрами может включать ожидание браузера и работу обработчиков. Признаки не доказывают причину просадки.",
		"User-Agent: " + (navigator.userAgent || "неизвестно"),
		"", "ПО ЭКРАНАМ И МИРАМ:", ...[...locations].map(([context, samples]) => context + " | " + perfReportSummary(samples)),
		"", "ПО СЕКУНДАМ:", ...timeline,
		"", "20 САМЫХ ДОЛГИХ КАДРОВ (время начала интервала):", ...worst,
	].join("\n");
}
function perfReportDownload(text, msg) {
	try {
		const a = document.createElement("a");
		a.href = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
		a.download = "otchyot-proizvoditelnosti-" + new Date().toISOString().slice(0, 10) + ".txt";
		document.body.appendChild(a);
		a.click();
		setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
		msg.textContent = "Файл скачан.";
	} catch (_) { msg.textContent = "Не удалось скачать файл — скопируйте текст вручную."; }
}
function perfReportCopy(text, ta, msg) {
	ta.focus(); ta.select();
	const done = () => { msg.textContent = "Скопировано."; };
	const fail = () => { msg.textContent = "Выделите текст и скопируйте вручную."; };
	try {
		if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fail);
		else if (document.execCommand && document.execCommand("copy")) done();
		else fail();
	} catch (_) { fail(); }
}
// Текст задаётся через value, а не HTML: userAgent и названия не превращаются в разметку.
function perfReportDialog(text) {
	const old = document.getElementById("mx-perf");
	if (old) old.remove();
	const wrap = document.createElement("div"), box = document.createElement("div");
	wrap.id = "mx-perf";
	wrap.style.cssText = "position:fixed;inset:0;z-index:99998;background:rgba(6,4,10,.8);display:flex;align-items:center;justify-content:center;font:14px/1.45 system-ui,sans-serif;color:#eee;padding:16px";
	box.style.cssText = "max-width:560px;width:100%;max-height:90vh;overflow:auto;background:#1c1626;border:1px solid #8e24aa;border-radius:14px;padding:18px 20px";
	box.innerHTML = '<div style="font-weight:800;font-size:17px;margin-bottom:6px">Отчёт о производительности</div>' +
		'<div style="color:#b9b3c8;margin-bottom:10px">Отчёт содержит сведения об устройстве и браузере. Скачайте файл или скопируйте текст.</div>' +
		'<textarea id="mx-perf-text" readonly style="width:100%;height:200px;box-sizing:border-box;background:#120e19;color:#d9d2e8;padding:8px"></textarea>' +
		'<div id="mx-perf-msg" style="min-height:20px;margin:8px 0"></div>' +
		'<div style="display:flex;flex-wrap:wrap;gap:8px"><button id="mx-perf-dl" style="flex:1;padding:10px">Скачать файл</button><button id="mx-perf-copy" style="flex:1;padding:10px">Копировать</button><button id="mx-perf-close" style="flex:1;padding:10px">Закрыть</button></div>';
	wrap.appendChild(box);
	document.body.appendChild(wrap);
	const $ = (id) => box.querySelector("#" + id), ta = $("mx-perf-text"), msg = $("mx-perf-msg");
	ta.value = text;
	$("mx-perf-close").onclick = () => wrap.remove();
	$("mx-perf-dl").onclick = () => perfReportDownload(text, msg);
	$("mx-perf-copy").onclick = () => perfReportCopy(text, ta, msg);
	return wrap;
}
