// Общая сборка исходников: используется и tools/build.mjs, и тестовой обвязкой.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const FONT_PLACEHOLDER = "@@FONT_BASE64@@";

export const readText = (root, p) => fs.readFileSync(path.join(root, p), "utf8");

export function loadAssetsJs(root) {
	const manifest = JSON.parse(readText(root, "assets/asset-manifest.json"));
	const atlas = readText(root, "assets/atlas.json");
	const ASSET = {};
	for (const [k, m] of Object.entries(manifest)) {
		ASSET[k] = `data:${m.mime};base64,` + fs.readFileSync(path.join(root, m.file)).toString("base64");
	}
	return '"use strict";\nconst ASSET = ' + JSON.stringify(ASSET) + ";\nconst ATLAS = " + atlas + ";\n";
}

export function gameFileList(root) {
	const dir = path.join(root, "src/game");
	const files = fs.readdirSync(dir).filter((f) => f.endsWith(".js"));
	files.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
	if (!files.length) throw new Error("в src/game нет файлов");
	return files;
}

export function loadGameSrc(root) {
	const font = fs.readFileSync(path.join(root, "assets/font.woff2")).toString("base64");
	const files = gameFileList(root);
	const raw = files.map((f) => readText(root, "src/game/" + f)).join("");
	// короткий хеш исходников — попадает в аварийный отчёт, чтобы было видно, какая сборка упала
	const build = crypto
		.createHash("sha256")
		.update(raw)
		.update(readText(root, "assets/asset-manifest.json"))
		.digest("hex")
		.slice(0, 12);
	return raw.split(FONT_PLACEHOLDER).join(font).split("@@BUILD@@").join(build);
}

// public — сборка «для друзей»: вместо ядра и загрузчика редактора в @@LOADER@@ встаёт src/runner.js
// (запуск игры, хранилище, ничего от редактора: ни интерфейса, ни настроек ИИ, ни пароля, ни версий кода)
export function buildHtml(root, { public: pub = false, v2 = false } = {}) {
	const shell = readText(root, "src/shell.html");
	// ядро редактора (чистые функции, тестируются в Node) + загрузчик с интерфейсом — вне #game-src,
	// поэтому ИИ-правки их не касаются
	const loader = pub ? readText(root, "src/runner.js") : readText(root, "src/editor/core.js") + "\n" + readText(root, "src/editor/loader.js");
	return shell
		.replace("</head>", v2 ? "<script>window.__mxV2Default=true;</script></head>" : "</head>")
		.replace("@@ASSETS@@", () => loadAssetsJs(root))
		.replace("@@SRC@@", () => loadGameSrc(root))
		.replace("@@LOADER@@", () => loader);
}

// код игры из готового HTML (index.html, dist/*.html): содержимое <script id="game-assets"> + <script id="game-src">
export function codeFromHtml(file) {
	const html = fs.readFileSync(file, "utf8");
	const part = (id) => {
		const m = html.match(new RegExp('<script type="text/plain" id="' + id + '">([\\s\\S]*?)</script>'));
		if (!m) throw new Error("в " + file + " нет секции " + id);
		return m[1];
	};
	return part("game-assets") + "\n" + part("game-src");
}
