// ===== Ядро ИИ-редактора: чистые функции без DOM (тестируются в Node, см. tests/unit/editor.test.mjs) =====
// Патчи «старое → новое», проверка синтаксиса, человеческие тексты ошибок API,
// маскирование ключа, хеш версии и правило удаления старых версий.
// Загрузчик (loader.js) и это ядро не редактируются ИИ: они лежат вне #game-src.
"use strict";
const MXCore = (() => {
	const unfence = (s) => s.replace(/^```[^\n]*\n/, "").replace(/\n```\s*$/, "");
	// ответ модели → список замен {f: старое, r: новое}
	function parsePatches(t) {
		const P = [],
			re = /@@@FIND\r?\n([\s\S]*?)\r?\n@@@REPLACE\r?\n([\s\S]*?)\r?\n?@@@END/g;
		let m;
		while ((m = re.exec(String(t || "")))) P.push({ f: unfence(m[1]), r: unfence(m[2]) });
		return P;
	}
	// атомарное применение: либо все замены легли (каждое «старое» найдено ровно один раз),
	// либо код не меняется вовсе и возвращается список понятных причин
	function applyPatches(code, P) {
		const bad = [];
		let out = code;
		P.forEach((p, i) => {
			const n = p.f ? out.split(p.f).length - 1 : 0;
			if (!p.f) bad.push("патч " + (i + 1) + ": пустой фрагмент для поиска");
			else if (n === 0) bad.push("патч " + (i + 1) + ": фрагмент не найден в коде (модель скопировала его неточно)");
			else if (n > 1) bad.push("патч " + (i + 1) + ": фрагмент встречается " + n + " раза, нужен ровно один — модель должна взять больше строк");
			else out = out.replace(p.f, () => p.r);
		});
		return bad.length ? { out: code, bad } : { out, bad };
	}
	function checkSyntax(code) {
		try {
			new Function(code);
			return { ok: true, error: "" };
		} catch (e) {
			return { ok: false, error: String((e && e.message) || e) };
		}
	}
	// ключи и токены не должны попадать в журнал, тосты и отчёты
	function maskSecrets(s, key) {
		let t = String(s == null ? "" : s);
		if (key && key.length >= 6) t = t.split(key).join(key.slice(0, 3) + "…" + key.slice(-2));
		return t
			.replace(/sk-[A-Za-z0-9_-]{6,}/g, "sk-***")
			.replace(/Bearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, "Bearer ***")
			.replace(/(["']?(?:api[_-]?key|key|token|secret|authorization)["']?\s*[:=]\s*)["'][^"']*["']/gi, '$1"***"');
	}
	// человеческий текст ошибки API: статус ответа, тело, либо исключение fetch
	function apiError(info) {
		info = info || {};
		const st = info.status | 0,
			body = String(info.body || "").slice(0, 160),
			err = info.error,
			name = err && err.name,
			msg = String((err && err.message) || "");
		if (name === "AbortError" || info.timeout) return "Модель не ответила за отведённое время (4 минуты). Попробуйте ещё раз или снизьте усилие модели.";
		if (info.tooLarge) return "Ответ модели слишком большой (" + Math.round((info.size || 0) / 1024) + " КБ) — сузьте запрос.";
		if (info.truncated) return "Ответ модели оборван лимитом токенов — увеличьте лимит ответа в панели или упростите запрос.";
		if (info.badJson) return "Сервер вернул непонятный ответ (не JSON). Проверьте Base URL: нужен адрес API, а не сайта.";
		if (info.empty) return "Пустой ответ модели — лимит ответа исчерпан размышлениями. Увеличьте лимит в панели.";
		if (err && (name === "TypeError" || /fetch|network|Failed to fetch|NetworkError|Load failed/i.test(msg)))
			return "Нет сети или сервер API недоступен (" + (msg || "ошибка сети").slice(0, 80) + "). Проверьте подключение и Base URL.";
		if (st === 401 || st === 403) return "Сервер не принял API-ключ (" + st + "). Проверьте ключ в разделе API.";
		if (st === 402) return "На счёте API закончились средства (402).";
		if (st === 404) return "Адрес API не найден (404). Проверьте Base URL и название модели.";
		if (st === 408 || st === 504) return "Сервер не успел ответить (" + st + "). Попробуйте ещё раз.";
		if (st === 413) return "Запрос слишком большой для сервера (413) — сузьте запрос.";
		if (st === 429) return "Превышен лимит запросов или квота API (429). Подождите минуту и повторите.";
		if (st >= 500) return "Сервер модели временно недоступен (" + st + "). Попробуйте позже.";
		if (st === 400) return "Сервер отклонил запрос (400): " + (body || "проверьте модель и параметры");
		if (st) return "Ошибка API " + st + (body ? ": " + body : "");
		return "Ошибка запроса к API: " + (msg || "неизвестная").slice(0, 120);
	}
	// признак оборванного ответа в обоих форматах (Responses и chat completions)
	function isTruncated(j) {
		if (!j || typeof j !== "object") return false;
		if (j.status === "incomplete" && j.incomplete_details && j.incomplete_details.reason === "max_output_tokens") return true;
		const ch = j.choices && j.choices[0];
		return !!(ch && (ch.finish_reason === "length" || ch.finish_reason === "max_tokens"));
	}
	// короткий хеш кода версии (FNV-1a 32 бит) — виден в истории и в отчётах
	function hash(s) {
		let h = 0x811c9dc5;
		for (let i = 0; i < s.length; i++) {
			h ^= s.charCodeAt(i);
			h = Math.imul(h, 0x01000193);
		}
		return (h >>> 0).toString(16).padStart(8, "0");
	}
	// какие версии удалить: оставляем limit новейших, «good» и «active» не удаляются никогда
	function pruneList(versions, good, act, limit) {
		const lim = limit || 15;
		const sorted = versions.slice().sort((a, b) => b.id - a.id);
		return sorted
			.slice(lim)
			.filter((v) => String(v.id) !== String(good) && String(v.id) !== String(act))
			.map((v) => v.id);
	}
	// текст наблюдателя для пробного запуска в песочнице: сообщает родителю, ожила ли игра
	// (READY, растёт FRAME_N, журнал ERRS пуст, экран — меню) или что именно упало
	function trialScript(ms) {
		return (
			"(function(){var T0=Date.now(),errs=[],post=function(m){try{parent.postMessage(Object.assign({mx:'trial'},m),'*')}catch(e){}};" +
			"addEventListener('error',function(e){errs.push(String(e.message||e).slice(0,160))});" +
			"addEventListener('unhandledrejection',function(e){errs.push('promise: '+String(e.reason&&e.reason.message||e.reason).slice(0,160))});" +
			"var f0=-1,ready=false;function look(){var st={};try{st.ready=READY;st.frame=FRAME_N;st.screen=S;st.errs=ERRS.length;st.first=ERRS.length?ERRS[0].kind+': '+ERRS[0].msg:''}catch(e){st.fail='нет глобалов игры: '+String(e&&e.message||e).slice(0,120)}return st}" +
			"var iv=setInterval(function(){var st=look(),el=Date.now()-T0;if(errs.length){clearInterval(iv);return post({ok:false,why:'исключение: '+errs[0],state:st})}" +
			"if(st.fail){if(el>8000){clearInterval(iv);return post({ok:false,why:st.fail,state:st})}return}" +
			"if(st.errs){clearInterval(iv);return post({ok:false,why:'ошибка в кадре: '+st.first,state:st})}" +
			"if(st.ready&&!ready){ready=true;f0=st.frame;T0=Date.now();return}" +
			"if(ready&&el>=" +
			(ms | 0) +
			"){clearInterval(iv);if(st.frame<=f0+5)return post({ok:false,why:'цикл кадра не идёт',state:st});if(st.screen!=='menu')return post({ok:false,why:'после загрузки не меню, а '+st.screen,state:st});return post({ok:true,state:st})}" +
			"if(!ready&&el>" +
			((ms | 0) * 3 + 6000) +
			"){clearInterval(iv);return post({ok:false,why:'игра не загрузилась за '+Math.round(el/1000)+' с',state:st})}},250)})();"
		);
	}
	return { parsePatches, applyPatches, checkSyntax, maskSecrets, apiError, isTruncated, hash, pruneList, trialScript, unfence };
})();
if (typeof window !== "undefined") window.MXCore = MXCore;
