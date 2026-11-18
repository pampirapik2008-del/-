#!/usr/bin/env node
// Локальный сервер готовой игры. По умолчанию доступны только известные сборки.
// npm run serve -- --port 8080; --all открывает весь репозиторий и его секреты.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILES = new Set(["/index.html", "/dist/game.html", "/dist/game-public.html", "/dist/SHA256SUMS.txt"]);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".md": "text/plain; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".png": "image/png", ".woff2": "font/woff2", ".svg": "image/svg+xml" };

// Путь проверяется после декодирования: иначе /dist/%2e%2e%2f.git обойдёт разрешённый префикс.
function requestPath(url) {
	try {
		const p = decodeURIComponent(url.split("?")[0]);
		if (!p.startsWith("/") || p.includes("\\") || p.includes("\0") || p.split("/").includes("..")) return null;
		return p === "/" ? "/index.html" : p === "/game.html" ? "/dist/game.html" : p;
	} catch (_) { return null; }
}

export function createGameServer({ root = ROOT, all = false } = {}) {
	const base = fs.realpathSync(root);
	const allowed = new Set([...FILES].map((p) => path.join(base, p.slice(1))));
	return http.createServer((req, res) => {
		if (req.method !== "GET" && req.method !== "HEAD") return res.writeHead(405, { Allow: "GET, HEAD" }).end();
		const rel = requestPath(req.url);
		if (!rel) return res.writeHead(400).end("плохой адрес");
		if (!all && !FILES.has(rel)) return res.writeHead(404).end("нет такого файла");
		const file = path.resolve(base, "." + rel);
		if (!file.startsWith(base + path.sep)) return res.writeHead(403).end("нельзя");
		fs.realpath(file, (err, real) => {
			if (err) return res.writeHead(404).end("нет такого файла");
			// Символическая ссылка не должна обходить корень и список разрешённых файлов.
			if (!real.startsWith(base + path.sep) || (!all && !allowed.has(real))) return res.writeHead(403).end("нельзя");
			fs.stat(real, (statErr, st) => {
				if (statErr || !st.isFile()) return res.writeHead(404).end("нет такого файла");
				res.writeHead(200, { "Content-Type": TYPES[path.extname(real).toLowerCase()] || "application/octet-stream", "Content-Length": st.size, "Cache-Control": "no-cache", "Last-Modified": st.mtime.toUTCString() });
				if (req.method === "HEAD") return res.end();
				fs.createReadStream(real).on("error", () => res.destroy()).pipe(res);
			});
		});
	});
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const args = process.argv.slice(2), i = args.indexOf("--port"), port = i < 0 ? 8080 : Number(args[i + 1]);
	if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("--port должен быть числом от 1 до 65535");
	const all = args.includes("--all"), server = createGameServer({ all });
	server.listen(port, "0.0.0.0", () => console.log(`игра: http://localhost:${port}/ (${all ? "весь репозиторий" : "только файлы игры"})`));
	for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => server.close(() => process.exit(0)));
}
