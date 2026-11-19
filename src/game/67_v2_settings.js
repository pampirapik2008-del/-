// ===== НАСТРОЙКИ V2 =====
// Флаг сборки задаёт только начальное значение; сохранённый выбор всегда важнее.
let V2 = typeof CFG.v2 === "boolean" ? CFG.v2 : !!window.__mxV2Default;
const V2UI = { entry: null, panel: null, controls: [], open: false, failed: false };
function v2Set(key, value) {
	if (!["v2", "v2Hit", "v2Dust", "v2Camera"].includes(key)) return;
	CFG[key] = !!value;
	if (key === "v2") V2 = CFG.v2;
	saveCfg();
	v2UiUpdate();
}
function v2UiUpdate() {
	for (const q of V2UI.controls) {
		q.input.checked = q.key === "v2" ? V2 : CFG[q.key] !== false;
		q.input.disabled = q.key !== "v2" && !V2;
	}
}
function v2UiRow(parent, key, label) {
	const row = document.createElement("label"), input = document.createElement("input"), text = document.createElement("span");
	row.style.cssText = "display:flex;align-items:center;gap:12px;padding:9px 0;font:16px system-ui;color:#fff;cursor:pointer";
	input.type = "checkbox";
	input.style.cssText = "width:24px;height:24px;accent-color:#81c784;flex:none";
	text.textContent = label;
	input.addEventListener("change", () => v2Set(key, input.checked));
	row.appendChild(input);
	row.appendChild(text);
	parent.appendChild(row);
	V2UI.controls.push({ key, input });
}
function v2UiCreate() {
	const entry = document.createElement("button"), panel = document.createElement("div"), box = document.createElement("div");
	entry.type = "button";
	entry.textContent = "Анимация и эффекты 2.0";
	entry.style.cssText = "position:fixed;right:8px;top:8px;z-index:90;background:#452657;color:white;border:1px solid #e5c7ff;border-radius:9px;padding:8px 12px;font:14px system-ui;touch-action:manipulation";
	panel.style.cssText = "display:none;position:fixed;inset:0;z-index:91;background:rgba(0,0,0,.72);align-items:center;justify-content:center";
	panel.setAttribute("role", "dialog");
	panel.setAttribute("aria-label", "Настройки анимации и эффектов 2.0");
	box.style.cssText = "background:#25152f;border:2px solid #a879bf;border-radius:14px;padding:14px 20px;max-width:90vw;max-height:88vh;overflow:auto;box-sizing:border-box";
	v2UiRow(box, "v2", "Новая анимация и эффекты 2.0");
	v2UiRow(box, "v2Hit", "Эффекты удара");
	v2UiRow(box, "v2Dust", "Тени и пыль");
	v2UiRow(box, "v2Camera", "Тряска камеры 2.0");
	const close = document.createElement("button");
	close.type = "button";
	close.textContent = "Готово";
	close.style.cssText = "padding:8px 24px;border-radius:8px;font:16px system-ui";
	close.addEventListener("click", () => { V2UI.open = false; v2UiUpdate(); });
	entry.addEventListener("click", () => { V2UI.open = true; v2UiUpdate(); });
	for (const el of [entry, panel]) {
		el.addEventListener("pointerdown", (e) => e.stopPropagation());
		el.addEventListener("touchstart", (e) => e.stopPropagation());
	}
	box.appendChild(close);
	panel.appendChild(box);
	document.body.appendChild(entry);
	document.body.appendChild(panel);
	V2UI.entry = entry;
	V2UI.panel = panel;
	v2UiUpdate();
}
// DOM оставляет поток canvas старого режима неизменным; за пределами настроек элементы скрыты.
function v2UiSync() {
	if (V2UI.failed) return;
	try {
		const active = Machine.is("settings");
		if (!V2UI.entry && active) v2UiCreate();
		if (!V2UI.entry) return;
		if (!active) V2UI.open = false;
		V2UI.entry.style.display = active && !V2UI.open ? "block" : "none";
		V2UI.panel.style.display = active && V2UI.open ? "flex" : "none";
	} catch (e) {
		V2UI.failed = true;
		logErr("v2-ui", e);
	}
}
