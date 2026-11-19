#!/usr/bin/env node
// Базовый стенд V2: Chromium, портативный вид, CPU ×4. Не заменяет измерения GPU телефона.
// npm run browser:setup && node tools/v2-bench.mjs [--seconds 3] [--out docs/v2-bench.json]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launch } from "./lib/browser.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2), opt = (k, d) => args.includes(k) ? args[args.indexOf(k) + 1] : d;
const SECONDS = Number(opt("--seconds", 3)), OUT = opt("--out", "docs/v2-bench.json");
const ONLY = opt("--ids", "").split(",").filter(Boolean), PROFILE = args.includes("--profile");
if (!(SECONDS >= 1 && SECONDS <= 30)) throw new Error("--seconds: от 1 до 30");
const DEVAPI = fs.readFileSync(path.join(ROOT, "tests/harness/devapi.js"), "utf8");
const prep = `__dev.seed(777); __dev.newGame(); for (let i=0;i<8;i++) __dev.setSlot(i, i<3 ? __dev.HEROES[i] : null); __dev.setWorld(0,12);`;
const fight = prep + ` __dev.fight('norm'); __dev.startFight(); for (const u of F.pl.concat(F.en)) { u.max=100000; u.hp=100000; u.atk=1; }`;
const boss = prep + ` __dev.fight('boss'); __dev.startFight(); for (const u of F.pl.concat(F.en)) { u.max=100000; u.hp=100000; u.atk=1; } F.lock=0;`;
// Всплеск нарочно ограничен началом замера: нельзя называть его непрерывным боем со всеми способностями.
const burst = `for (const u of F.pl) { u.en=100; if (CAST[u.k] && CAST[u.k].ult) CAST[u.k].ult(u); } Fx.add({ k:'flash', c:'#fff', d:0.7 });`;
const SCENARIOS = [
	{ id: "menu", label: "Главное меню", setup: `__dev.S='menu';` },
	{ id: "map", label: "Карта (готовый фон)", setup: prep + ` __dev.bakeNow(); __dev.S='map';` },
	{ id: "prep", label: "Расстановка", setup: prep + ` __dev.fight('norm');` },
	{ id: "fight", label: "Бой, 3 против 5", setup: fight },
	{ id: "boss", label: "Босс, искусственный всплеск способностей", setup: boss, timed: burst },
	{ id: "victory", label: "Победа босса после искусственного завершения боя", setup: boss, timed: burst + ` F.en=[]; F.cat=null; checkFightEnd();` },
	{ id: "chest", label: "Сундук босса с автоматическим открытием", setup: boss + ` Seq.clear(); win(); EV.next();` },
	{ id: "world", label: "Вход в следующий мир", setup: boss + ` Seq.clear(); win(); EV.next(); EV.next();`, timed: `nextWorld();` },
	{ id: "entry", label: "Вход в бой и расстановку", setup: prep + ` __dev.bakeNow(); __dev.S='map';`, timed: `__dev.fight('norm');` },
	{ id: "bake", label: "Новая игра и сборка карты", setup: `__dev.seed(777); __dev.S='menu';`, timed: `startPick();` },
];
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x,y)=>x-y), m=(s.length-1)/2; return (s[Math.floor(m)]+s[Math.ceil(m)])/2; };
const p95 = (a) => { if (!a.length) return null; return [...a].sort((x,y)=>x-y)[Math.ceil(a.length*.95)-1]; };
const round = (x) => x == null ? null : +x.toFixed(2);

// Счётчик включается отдельным прогоном: обёртки canvas сами замедляют отрисовку.
async function installCounts(page) {
	await page.evaluate(() => {
		const proto = CanvasRenderingContext2D.prototype;
		window.__canvasCount = { total: 0, blend: 0, lighter: 0 };
		for (const key of ["save","restore","translate","rotate","scale","setTransform","clearRect","fillRect","strokeRect","beginPath","closePath","moveTo","lineTo","quadraticCurveTo","bezierCurveTo","arc","ellipse","rect","fill","stroke","clip","fillText","strokeText","drawImage","setLineDash","putImageData","createLinearGradient","createRadialGradient"]) {
			const original = proto[key]; if (typeof original !== "function") continue;
			proto[key] = function (...args) { window.__canvasCount.total++; return original.apply(this, args); };
		}
		const d = Object.getOwnPropertyDescriptor(proto, "globalCompositeOperation");
		if (d && d.set) Object.defineProperty(proto, "globalCompositeOperation", { ...d, set(v) { window.__canvasCount.blend++; if (v === "lighter") window.__canvasCount.lighter++; return d.set.call(this, v); } });
	});
}
async function measure(browser, scenario, count, profile = false) {
	const context = await browser.createBrowserContext(), page = await context.newPage();
	const errors=[]; page.on("pageerror", e => errors.length < 10 && errors.push(e.message)); page.on("console", m => { if (m.type() === "error") errors.length < 10 && errors.push(m.text()); });
	await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
	const cdp = await page.createCDPSession();
	await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
	await page.goto(pathToFileURL(path.join(ROOT, "index.html")).href);
	await page.waitForFunction("typeof READY !== 'undefined' && READY && G", { timeout: 60000 });
	await page.addScriptTag({ content: DEVAPI });
	await page.evaluate(() => __dev.run("setQ(0); hiDpi()"));
	await page.evaluate((code) => __dev.run(code), scenario.setup);
	await new Promise(r => setTimeout(r, 1000));
	if (count) await installCounts(page);
	if (profile) { await cdp.send("Profiler.enable"); await cdp.send("Profiler.start"); }
	const start = await page.evaluate((timed) => {
		__dev.run("perfReportStart()\n");
		if (window.__canvasCount) Object.assign(window.__canvasCount,{total:0,blend:0,lighter:0});
		const before = performance.now();
		if (timed) __dev.run(timed);
		return performance.now() - before;
	}, scenario.timed || "");
	await new Promise(r => setTimeout(r, SECONDS * 1000));
	const cpu = profile ? (await cdp.send("Profiler.stop")).profile : null;
	const got = await page.evaluate(() => ({
		samples: __dev.run("PERF_REPORT.samples.map(x => ({frame:x.frame,update:x.update,draw:x.draw,activity:x.activity,context:x.context,units:x.units,effects:x.effects,particles:x.particles,projectiles:x.projectiles}))"),
		counts: window.__canvasCount || null, errors: __dev.errs(), screen: __dev.S,
	}));
	await context.close();
	if (errors.length || got.errors.length) throw new Error(scenario.id + ": " + JSON.stringify({ errors:errors.slice(0,3), game:got.errors.slice(0,3) }));
	const frames=got.samples.map(s=>s.frame), sum=frames.reduce((a,b)=>a+b,0), n=frames.length;
	return {
		frames:n, fps:round(sum ? n*1000/sum : null), worst5:round(p95(frames) ? 1000/p95(frames) : null),
		updateMedian:round(median(got.samples.map(x=>x.update))), update95:round(p95(got.samples.map(x=>x.update))),
		drawMedian:round(median(got.samples.map(x=>x.draw))), draw95:round(p95(got.samples.map(x=>x.draw))),
		maxFrame:round(n ? Math.max(...frames) : null), over60:n ? round(100*frames.filter(x=>x>60).length/n) : null,
		setupMs:round(start), screen:got.screen,
		observed: { units: [...new Set(got.samples.map(x => x.units))], effectsMax: Math.max(0,...got.samples.map(x=>x.effects)), activities: [...new Set(got.samples.map(x=>x.activity))] },
		worst:got.samples.slice().sort((a,b)=>b.frame-a.frame).slice(0,20).map(x=>({frame:round(x.frame),update:round(x.update),draw:round(x.draw),activity:x.activity,context:x.context,units:x.units,effects:x.effects,particles:x.particles,projectiles:x.projectiles})),
		profile: cpu ? { sampleCount: cpu.samples?.length || 0, durationMs: round((cpu.endTime-cpu.startTime)/1000), topSelf: cpu.nodes.filter(n => n.hitCount).sort((a,b) => b.hitCount-a.hitCount).slice(0,30).map(n => ({ name: n.callFrame.functionName || "(anonymous)", url: n.callFrame.url.replace(/^data:.*/, "data:…"), line: n.callFrame.lineNumber+1, samples: n.hitCount })) } : null,
		counts:got.counts ? { commandsPerFrame:round(got.counts.total/Math.max(1,n)), blendsPerFrame:round(got.counts.blend/Math.max(1,n)), lighterPerFrame:round(got.counts.lighter/Math.max(1,n)) } : null,
	};
}
const browser = await launch();
try {
	const out = { date: new Date().toISOString(), browser: await browser.version(), cpu:4, viewport:"844×390 DPR 2, качество 0, R=1", seconds:SECONDS, scenario:[] };
	if (ONLY.some(id => !SCENARIOS.some(s => s.id === id))) throw new Error("Неизвестный сценарий в --ids");
	for (const s of SCENARIOS.filter(s => !ONLY.length || ONLY.includes(s.id))) {
		const timing = await measure(browser,s,false), counts = await measure(browser,s,true);
		const prof = PROFILE ? (await measure(browser,s,false,true)).profile : null;
		out.scenario.push({ id:s.id,label:s.label,timing,counts:counts.counts,profile:prof });
		fs.mkdirSync(path.dirname(OUT),{recursive:true}); fs.writeFileSync(OUT, JSON.stringify(out,null,2)+"\n");
		console.log(`${s.label}: ${timing.fps} FPS; худшие 5% ${timing.worst5}; draw p95 ${timing.draw95} мс; команд/кадр ${counts.counts.commandsPerFrame}`);
	}
	fs.mkdirSync(path.dirname(OUT),{recursive:true}); fs.writeFileSync(OUT, JSON.stringify(out,null,2)+"\n");
	console.log("данные:", OUT);
} finally { await browser.close(); }
