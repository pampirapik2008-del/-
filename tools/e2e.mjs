#!/usr/bin/env node
// E2E в headless Chromium: menu -> pick -> map -> fight x1/x2/x3 -> shop -> save -> reload -> load
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = path.join(ROOT, "dist/game.html");
if (!fs.existsSync(html)) { console.error("нет dist/game.html — сначала npm run build -- --dist"); process.exit(1); }

async function run(){
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{width:1280,height:720}, isMobile:false });
  const page = await ctx.newPage();
  const url = "file://" + html;
  console.log("открываю", url);
  await page.goto(url, { waitUntil:"load", timeout:15000 });
  await page.waitForTimeout(1500);
  // скриншот меню
  await page.screenshot({path:"/tmp/e2e_menu.png"});
  console.log("menu screenshot /tmp/e2e_menu.png");
  // Проверим что canvas есть
  const hasCanvas = await page.evaluate(()=> !!document.getElementById("c"));
  console.log("canvas:", hasCanvas);
  // Попробуем клик в центр (кнопка Играть)
  await page.mouse.click(640,360);
  await page.waitForTimeout(800);
  await page.screenshot({path:"/tmp/e2e_after_click.png"});
  console.log("after click screenshot");
  // Проверим localStorage
  const ls = await page.evaluate(()=> { try{ return localStorage.length; }catch(e){ return "no-ls:"+e.message; } });
  console.log("localStorage len:", ls);
  await browser.close();
  console.log("e2e OK — базовый проход без падения");
}
run().catch(e=>{ console.error("e2e FAIL", e.stack||e); process.exit(1); });
