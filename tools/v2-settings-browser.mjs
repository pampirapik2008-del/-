#!/usr/bin/env node
// Реальная мобильная проверка переключателей и выбора сборки без доступа к сети.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { launch } from "./lib/browser.mjs";
const root = process.cwd(), api = fs.readFileSync(path.join(root, "tests/harness/devapi.js"), "utf8");
const browser = await launch({ width: 844, height: 390, dpr: 2, mobile: true });
try {
	for (const file of ["game.html", "game-public.html", "game-v2.html", "game-v2-public.html"]) {
		const context = await browser.createBrowserContext(), page = await context.newPage();
		const errors = [];
		page.on("pageerror", e => errors.push(e.message));
		page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
		await page.goto(pathToFileURL(path.join(root, "dist", file)).href);
		await page.waitForFunction("typeof READY !== 'undefined' && READY && G", { timeout: 60000 });
		await page.addScriptTag({ content: api });
		const initial = await page.evaluate(() => __dev.run("V2"));
		assert.equal(initial, file.startsWith("game-v2"), file + " по умолчанию");
		await page.evaluate(() => __dev.run('Machine.go("settings")'));
		const entry = await page.waitForSelector('button::-p-text(Анимация и эффекты 2.0)', { visible: true, timeout: 15000 });
		await entry.click();
		const dialog = await page.waitForSelector('[role="dialog"]', { visible: true });
		const check = await dialog.$$('input[type=checkbox]');
		assert.equal(check.length, 4);
		if (!initial) await check[0].click();
		await check[1].click();
		assert.equal(await page.evaluate(() => __dev.run('V2 && CFG.v2Hit === false')), true);
		await dialog.$eval("button", b => b.click());
		await page.waitForFunction(() => getComputedStyle(document.querySelector('[role="dialog"]')).display === "none");
		await page.evaluate(() => __dev.run('Machine.go("menu")'));
		await page.waitForFunction(() => getComputedStyle(document.querySelector('[role="dialog"]')).display === "none");
		await page.reload();
		await page.waitForFunction("typeof READY !== 'undefined' && READY && G", { timeout: 60000 });
		await page.addScriptTag({ content: api });
		assert.equal(await page.evaluate(() => __dev.run('V2 && CFG.v2Hit === false')), true, file + " после перезагрузки");
		assert.deepEqual(errors, []);
		await context.close();
		console.log(file + ": настройки и перезагрузка OK");
	}
} finally { await browser.close(); }
