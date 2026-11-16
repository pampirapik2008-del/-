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

export function buildHtml(root) {
	const shell = readText(root, "src/shell.html");
	const loader = readText(root, "src/editor/loader.js");
	return shell
		.replace("@@ASSETS@@", () => loadAssetsJs(root))
		.replace("@@SRC@@", () => loadGameSrc(root))
		.replace("@@LOADER@@", () => loader);
}
