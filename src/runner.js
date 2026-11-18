(() => {
	"use strict";
	// Запуск игры без редактора (сборка «для друзей», dist/game-public.html).
	// Тот же путь старта, что и у загрузчика редактора: код игры лежит в <script type="text/plain">
	// и выполняется одним скриптом; отличие — здесь нет ни интерфейса ИИ, ни пароля, ни версий кода.
	// В защищённом просмотре (почта, мессенджер) хранилище может быть запрещено — тогда сохранения живут
	// в памяти до закрытия вкладки, о чём игрок предупреждается.
	let LS,
		temp = false;
	try {
		LS = window.localStorage;
		LS.getItem("mx_storage_probe");
	} catch (e) {
		temp = true;
		const m = new Map();
		LS = { getItem: (k) => (m.has(String(k)) ? m.get(String(k)) : null), setItem: (k, v) => m.set(String(k), String(v)), removeItem: (k) => m.delete(String(k)) };
	}
	window.__mxStorage = LS;
	window.__mxPublic = true; // игра прячет кнопку «Режим разработчика»
	const part = (id) => document.getElementById(id).textContent;
	const s = document.createElement("script");
	s.textContent = part("game-assets") + part("game-src");
	document.body.appendChild(s);
	if (temp) {
		const t = document.createElement("div");
		t.textContent = "В этом просмотре сохранения временные. Для сохранения откройте скачанный файл в браузере.";
		t.style.cssText = "position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:99999;background:#2a0d10;color:#ffb4b4;border:1px solid #7a1c24;border-radius:12px;padding:9px 14px;font:13px system-ui;max-width:92vw;text-align:center";
		document.body.appendChild(t);
		setTimeout(() => t.remove(), 9000);
	}
})();
