// Локальный сервер: готовые сборки, методы, границы доступа и обходы пути.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { createGameServer } from "../../tools/serve.mjs";

async function fixture(t, all = false) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "game-server-"));
	fs.mkdirSync(path.join(root, "dist"));
	fs.mkdirSync(path.join(root, ".git"));
	fs.writeFileSync(path.join(root, "index.html"), "index");
	fs.writeFileSync(path.join(root, "dist/game.html"), "game");
	fs.writeFileSync(path.join(root, "dist/SHA256SUMS.txt"), "sums");
	fs.writeFileSync(path.join(root, ".git/config"), "private");
	fs.symlinkSync(path.join(root, ".git/config"), path.join(root, "dist/game-public.html"));
	const server = createGameServer({ root, all });
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	t.after(async () => {
		await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
		fs.rmSync(root, { recursive: true, force: true });
	});
	const request = (url, method = "GET") => new Promise((resolve, reject) => {
		const req = http.request({ hostname: "127.0.0.1", port: server.address().port, path: url, method }, (res) => {
			let body = "";
			res.setEncoding("utf8");
			res.on("data", (data) => { body += data; });
			res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
		});
		req.on("error", reject);
		req.end();
	});
	return { request };
}

test("сервер отдаёт актуальные сборки, HTML в UTF-8 и HEAD", async (t) => {
	const { request } = await fixture(t);
	assert.equal((await request("/")).body, "index");
	const game = await request("/game.html?x=1");
	assert.equal(game.body, "game");
	assert.equal(game.headers["content-type"], "text/html; charset=utf-8");
	assert.equal(game.headers["cache-control"], "no-cache");
	assert.equal((await request("/dist/SHA256SUMS.txt")).body, "sums");
	const head = await request("/dist/game.html", "HEAD");
	assert.equal(head.status, 200);
	assert.equal(head.body, "");
	assert.equal(head.headers["content-length"], "4");
	assert.equal((await request("/", "POST")).status, 405);
});

test("сервер по умолчанию не раскрывает репозиторий и не допускает обходы", async (t) => {
	const { request } = await fixture(t);
	assert.equal((await request("/.git/config")).status, 404);
	assert.equal((await request("/dist/%2e%2e%2f.git/config")).status, 400);
	assert.equal((await request("/dist/../.git/config")).status, 400);
	assert.equal((await request("/dist/%5c..%5c.git/config")).status, 400);
	assert.equal((await request("/%zz")).status, 400);
	assert.equal((await request("/dist/game-public.html")).status, 403);
});

test("--all явно открывает корень, но не допускает выход из него", async (t) => {
	const { request } = await fixture(t, true);
	assert.equal((await request("/.git/config")).body, "private");
	assert.equal((await request("/%2e%2e%2fsecret")).status, 400);
});
