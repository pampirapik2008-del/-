// ===== 62_save.js =====
// СОХРАНЕНИЯ: формат v3, контрольная сумма, резервный слот, миграции.
//
// Конверт:  { v:3, sum:"fnv1a", at:<мс>, data:"<json строки>" }
// data:     { N, E, sd, bi, g } — то же содержимое, что писалось в v2.
// Запись:   сначала в резерв кладётся прошлое валидное сохранение, потом пишется основное.
// Чтение:   основное → резерв → ошибка. Несовпавшая сумма = повреждение, читаем резерв.
// Миграция: цепочка v2 → v3 (дальше можно добавлять v3 → v4, не ломая старые сейвы).
const SAVE_VER = 3;
let SAVE_WARN = "";

function fnv1a(s) {
	let h = 0x811c9dc5;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return (h >>> 0).toString(16).padStart(8, "0");
}

// внутреннее содержимое сейва: из строки любого поддерживаемого формата
function saveInner(q) {
	const d = typeof q === "string" ? JSON.parse(q) : q;
	if (!d || typeof d !== "object") return null;
	if (d.v === 2) return { N: d.N, E: d.E, sd: d.sd, bi: d.bi | 0, g: d.g };
	if (d.N || d.g) return { N: d.N, E: d.E, sd: d.sd, bi: d.bi | 0, g: d.g };
	return null;
}

function packSave(inner) {
	const body = JSON.stringify(inner);
	return JSON.stringify({ v: SAVE_VER, sum: fnv1a(body), at: Date.now(), data: body });
}

// цепочка миграций: каждую версию поднимаем на шаг, пока не дошли до текущей
const SAVE_MIGRATIONS = {
	2: (d) => ({ N: d.N, E: d.E, sd: d.sd, bi: d.bi | 0, g: d.g }),
};
function migrateSave(d) {
	let v = typeof d.v === "number" ? d.v : 2,
		cur = d;
	let guard = 0;
	while (v < SAVE_VER) {
		const step = SAVE_MIGRATIONS[v];
		if (!step || ++guard > 8) return null;
		cur = step(cur);
		v++;
	}
	return cur;
}

// разбор строки из хранилища: { ok, data, ver } либо { ok:false, why }
function unpackSave(raw) {
	if (!raw || typeof raw !== "string") return { ok: false, why: "пусто" };
	let d;
	try {
		d = JSON.parse(raw);
	} catch (e) {
		return { ok: false, why: "json" };
	}
	if (!d || typeof d !== "object" || Array.isArray(d)) return { ok: false, why: "не объект" };
	if (d.v === SAVE_VER && typeof d.data === "string") {
		if (typeof d.sum === "string" && d.sum !== fnv1a(d.data)) return { ok: false, why: "checksum" };
		let inner;
		try {
			inner = JSON.parse(d.data);
		} catch (e) {
			return { ok: false, why: "inner" };
		}
		if (!inner || typeof inner !== "object") return { ok: false, why: "inner" };
		return { ok: true, data: inner, ver: SAVE_VER };
	}
	if (typeof d.v === "number" && d.v < SAVE_VER) {
		const m = migrateSave(d);
		if (!m) return { ok: false, why: "migrate" };
		return { ok: true, data: m, ver: d.v };
	}
	return { ok: false, why: "version" };
}

// проверка содержимого ДО изменения глобального состояния
function validateSave(d) {
	const g = d.g;
	if (!Array.isArray(d.N) || !d.N.length || !Array.isArray(d.E) || !g || typeof g !== "object" || !Array.isArray(g.slots)) return null;
	if ((g.vis != null && !Array.isArray(g.vis)) || (g.rel != null && !Array.isArray(g.rel))) return null;
	if (g.cur != null && (!Number.isInteger(+g.cur) || +g.cur < 0 || +g.cur >= d.N.length)) return null;
	if (d.N.some((node) => !node || !Number.isFinite(+node.x) || !Number.isFinite(+node.y))) return null;
	if (
		d.E.some(
			(edge) =>
				!Array.isArray(edge) ||
				edge.length < 2 ||
				!Number.isInteger(edge[0]) ||
				!Number.isInteger(edge[1]) ||
				edge[0] < 0 ||
				edge[1] < 0 ||
				edge[0] >= d.N.length ||
				edge[1] >= d.N.length
		)
	)
		return null;
	const sl = g.slots.map((o) => {
		if (!o || typeof o !== "object") return null;
		const h = HEROES.find((x) => x.n === (o.n === "Грозовой автомат" ? "Грозовой маг" : o.n));
		if (!h) return null;
		const u = mkU(h, 0, 0, 0);
		// Некорректные числа не должны распространяться в симуляцию и интерфейс.
		const positive = (v, fallback) => (Number.isFinite(+v) && +v > 0 ? +v : fallback);
		const nonnegative = (v, fallback) => (v != null && Number.isFinite(+v) && +v >= 0 ? +v : fallback);
		u.max = positive(o.max, u.max);
		u.hp = clamp(nonnegative(o.hp, 0), 0, u.max);
		u.atk = positive(o.atk, u.atk);
		u.arm = nonnegative(o.arm, 0);
		u.aspd = positive(o.aspd, u.aspd);
		u.spd = positive(o.spd, u.spd);
		u.skull = !!o.skull;
		u.r = clamp(o.r | 0, 0, 6);
		u.lv = positive(o.lv, 1);
		u.hpl = u.hp / u.max;
		return u;
	});
	while (sl.length < 8) sl.push(null);
	if (!sl.some(Boolean)) return null;
	return { sl, g };
}

function applySave(d, v) {
	const g = v.g,
		sl = v.sl;
	N = d.N;
	E = d.E;
	ADJ = N.map(() => []);
	E.forEach(([a, b]) => {
		ADJ[a].push(b);
		ADJ[b].push(a);
	});
	// сохранения старого формата: слои узлов восстанавливаем по порядку вдоль пути
	if (N.some((n) => n.ly === undefined)) {
		const xs = [...new Set(N.map((n) => Math.round(n.x / 40)))].sort((a, b) => a - b);
		N.forEach((n) => (n.ly = xs.indexOf(Math.round(n.x / 40))));
	}
	G = freshG();
	Object.assign(G, {
		coin: Number.isFinite(+g.coin) ? Math.max(0, +g.coin) : 0,
		meat: Number.isFinite(+g.meat) ? Math.max(0, +g.meat) : 0,
		slots: sl,
		cur: g.cur | 0,
		vis: new Set(g.vis || [0]),
		depth: g.depth | 0,
		bf: Object.assign({ atk: 0, hp: 0, arm: 0, as: 0, spd: 0 }, g.bf || {}),
		shop: !!g.shop,
		w: clamp(g.w | 0, 0, worldCount() - 1),
		rel: (g.rel || [])
			.filter((q) => q && typeof q === "object" && Object.prototype.hasOwnProperty.call(RELIC, q.id))
			.map((q) => ({ ...q, r: clamp(q.r | 0, 0, RAR.length - 1) })),
		stock: g.stock || null,
		pend: g.pend || null,
	});
	if (g.st) Object.assign(G.st, g.st);
	bakeMap(d.sd || 7);
	snap = null;
	sel = -1;
	pop = null;
	paused = false;
	F = null;
	EV = null;
	MV = null;
	Seq.clear();
	Parts.clear();
	Machine.go("map");
	if (G.pend) {
		fight(G.pend);
		snap = JSON.stringify(d);
	}
}

function saveGame() {
	if (!G || G.arena) return false;
	try {
		const q = S === "prep" || S === "fight" ? snap : S === "lose" || S === "win" ? null : ser();
		if (!q) return false;
		const inner = saveInner(q);
		if (!inner) return false;
		// резерв = прошлое валидное сохранение (а не то, что сейчас пытаемся записать)
		const prev = window.__mxStorage.getItem(SAVEK);
		if (prev && unpackSave(prev).ok) {
			try {
				window.__mxStorage.setItem(SAVEK_B, prev);
			} catch (e) {}
		}
		window.__mxStorage.setItem(SAVEK, packSave(inner));
		SAVED = true;
		SAVE_WARN = "";
		return true;
	} catch (e) {
		SAVE_WARN = "Не удалось сохранить: " + (e && e.message ? e.message : e);
		logErr("save", e);
		return false;
	}
}

function loadGame() {
	const sources = [SAVEK, SAVEK_B];
	let why = "";
	for (let i = 0; i < sources.length; i++) {
		let raw = null;
		try {
			raw = window.__mxStorage.getItem(sources[i]);
		} catch (e) {
			raw = null;
		}
		if (!raw) continue;
		const u = unpackSave(raw);
		if (!u.ok) {
			why = why || u.why;
			continue;
		}
		const v = validateSave(u.data);
		if (!v) {
			why = why || "поля";
			continue;
		}
		try {
			applySave(u.data, v);
		} catch (e) {
			why = why || "apply";
			logErr("loadGame", e);
			continue;
		}
		SAVE_WARN = "";
		if (i > 0) {
			SAVE_WARN = "Основное сохранение повреждено — загружен резерв.";
			try {
				toast(SAVE_WARN);
			} catch (e) {}
		}
		if (u.ver !== SAVE_VER) {
			// старый формат поднят до текущего — сразу перезаписываем в новом виде
			try {
				saveGame();
			} catch (e) {}
		}
		return true;
	}
	if (why) logErr("loadGame", "сохранение не прочитано: " + why);
	return false;
}

// ---------- перенос сохранения файлом ----------
// Запасной путь, когда хранилище браузера недоступно или игру открывают на другом устройстве:
// текст сохранения (конверт v3) можно скачать файлом / скопировать и затем вставить обратно.
const SAVE_WHY = {
	"пусто": "текст пустой",
	json: "это не JSON сохранения",
	"не объект": "это не сохранение игры",
	checksum: "контрольная сумма не совпала — файл повреждён или изменён",
	inner: "содержимое сохранения повреждено",
	migrate: "не удалось поднять старый формат",
	version: "неизвестная версия сохранения",
	"поля": "в сохранении не хватает данных отряда или карты",
};
function exportSaveText() {
	try {
		const raw = window.__mxStorage.getItem(SAVEK);
		return raw && unpackSave(raw).ok ? raw : null;
	} catch (e) {
		return null;
	}
}
// проверка и атомарная запись: прошлое валидное сохранение уходит в резерв, новое пишется в формате v3
function importSaveText(text) {
	const raw = String(text == null ? "" : text).trim();
	const u = unpackSave(raw);
	if (!u.ok) return { ok: false, why: SAVE_WHY[u.why] || u.why };
	const v = validateSave(u.data);
	if (!v) return { ok: false, why: SAVE_WHY["поля"] };
	try {
		const prev = window.__mxStorage.getItem(SAVEK);
		if (prev && prev !== raw && unpackSave(prev).ok) window.__mxStorage.setItem(SAVEK_B, prev);
		window.__mxStorage.setItem(SAVEK, packSave(u.data));
	} catch (e) {
		logErr("save", e);
		return { ok: false, why: "хранилище недоступно: " + (e && e.message ? e.message : e) };
	}
	SAVED = true;
	SAVE_WARN = "";
	return { ok: true, ver: u.ver };
}
// окно экспорта/импорта — на DOM (как аварийное окно, см. DECISIONS D7): нужны настоящие
// текстовое поле, кнопка скачивания и выбор файла, которых у холста нет
function saveDialog(mode) {
	try {
		const old = document.getElementById("mx-save");
		if (old) old.remove();
	} catch (_) {}
	const wrap = document.createElement("div");
	wrap.id = "mx-save";
	wrap.style.cssText =
		"position:fixed;inset:0;z-index:99998;background:rgba(6,4,10,.8);display:flex;align-items:center;justify-content:center;font:14px/1.45 system-ui,sans-serif;color:#eee;padding:16px";
	const box = document.createElement("div");
	box.style.cssText = "max-width:560px;width:100%;background:#1c1626;border:1px solid #8e24aa;border-radius:14px;padding:18px 20px";
	const bt = (id, label, bg) => '<button id="' + id + '" style="flex:1 1 120px;padding:10px;border:0;border-radius:8px;background:' + bg + ';color:#fff;font-weight:700;cursor:pointer">' + label + "</button>";
	const exp = mode === "export";
	box.innerHTML =
		'<div style="font-weight:800;font-size:17px;margin-bottom:6px">' + (exp ? "Экспорт сохранения" : "Импорт сохранения") + "</div>" +
		'<div style="color:#b9b3c8;margin-bottom:10px">' +
		(exp ? "Скачайте файл или скопируйте текст — его можно загрузить через «Импорт» на другом устройстве или в другом браузере." : "Выберите файл сохранения или вставьте его текст. Текущее сохранение уйдёт в резерв.") +
		"</div>" +
		(exp ? "" : '<input id="mx-save-file" type="file" accept=".json,.txt,application/json,text/plain" style="display:block;margin-bottom:10px;color:#eee">') +
		'<textarea id="mx-save-text" ' + (exp ? "readonly " : "") + 'spellcheck="false" style="width:100%;height:120px;box-sizing:border-box;background:#120e19;color:#d9d2e8;border:1px solid #3a2f4d;border-radius:8px;padding:8px;font:12px/1.4 ui-monospace,monospace;resize:vertical"></textarea>' +
		'<div id="mx-save-msg" style="min-height:20px;margin:8px 0;color:#ffb3b3"></div>' +
		'<div style="display:flex;flex-wrap:wrap;gap:8px">' +
		(exp ? bt("mx-save-dl", "Скачать файл", "#2e7d32") + bt("mx-save-copy", "Копировать", "#455a64") : bt("mx-save-load", "Загрузить", "#2e7d32")) +
		bt("mx-save-close", "Закрыть", "#8e24aa") +
		"</div>";
	wrap.appendChild(box);
	try {
		document.body.appendChild(wrap);
	} catch (_) {
		return null;
	}
	const $ = (id) => box.querySelector("#" + id);
	const say = (m, ok) => {
		try {
			$("mx-save-msg").textContent = m;
			$("mx-save-msg").style.color = ok ? "#9be7a4" : "#ffb3b3";
		} catch (_) {}
	};
	const close = () => {
		try {
			wrap.remove();
		} catch (_) {}
	};
	try {
		$("mx-save-close").onclick = close;
		if (exp) {
			const text = exportSaveText();
			$("mx-save-text").value = text || "";
			if (!text) say("Сохранения пока нет — нечего экспортировать.");
			$("mx-save-dl").onclick = () => {
				if (!text) return;
				try {
					const a = document.createElement("a");
					a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
					a.download = "probuzhdenie-monstrov-save-" + new Date().toISOString().slice(0, 10) + ".json";
					document.body.appendChild(a);
					a.click();
					setTimeout(() => {
						URL.revokeObjectURL(a.href);
						a.remove();
					}, 2000);
					say("Файл скачан.", true);
				} catch (e) {
					say("Браузер не дал скачать файл — скопируйте текст вручную.");
				}
			};
			$("mx-save-copy").onclick = () => {
				if (!text) return;
				const ta = $("mx-save-text");
				try {
					ta.focus();
					ta.select();
				} catch (_) {}
				const done = () => say("Скопировано.", true);
				try {
					if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => say("Выделите текст и скопируйте вручную."));
					else if (document.execCommand && document.execCommand("copy")) done();
					else say("Выделите текст и скопируйте вручную.");
				} catch (e) {
					say("Выделите текст и скопируйте вручную.");
				}
			};
		} else {
			const fileEl = $("mx-save-file");
			if (fileEl)
				fileEl.onchange = () => {
					const f = fileEl.files && fileEl.files[0];
					if (!f) return;
					if (f.size > 2000000) return say("Файл слишком большой для сохранения игры.");
					const rd = new FileReader();
					rd.onload = () => {
						$("mx-save-text").value = String(rd.result || "");
						say("Файл прочитан — нажмите «Загрузить».", true);
					};
					rd.onerror = () => say("Не удалось прочитать файл.");
					rd.readAsText(f);
				};
			$("mx-save-load").onclick = () => {
				const r = importSaveText($("mx-save-text").value);
				if (!r.ok) return say("Не загружено: " + r.why);
				say("Сохранение загружено" + (r.ver !== SAVE_VER ? " (старый формат v" + r.ver + " поднят до v" + SAVE_VER + ")" : "") + ". Нажмите «Продолжить» в меню.", true);
				try {
					toast("Сохранение загружено");
				} catch (_) {}
			};
		}
	} catch (_) {}
	return wrap;
}

function autosave() {
	if (G && !G.arena && (S === "map" || S === "prep" || S === "world")) saveGame();
}

// автосохранение при уходе со страницы и сворачивании вкладки
try {
	addEventListener("pagehide", () => {
		try {
			autosave();
		} catch (e) {}
	});
	document.addEventListener("visibilitychange", () => {
		try {
			if (document.hidden) autosave();
		} catch (e) {}
	});
} catch (e) {}
