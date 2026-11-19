#!/usr/bin/env node
// Микрозамеры JS анимации под CPU ×4: не включают drawImage, GPU или стоимость всей сцены.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { launch } from "./lib/browser.mjs";
const root = process.cwd(), api = fs.readFileSync(path.join(root, "tests/harness/devapi.js"), "utf8");
const browser = await launch({ width: 844, height: 390, dpr: 2, mobile: true });
try {
	const page = await browser.newPage(), cdp = await page.createCDPSession();
	await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
	await page.goto(pathToFileURL(path.join(root, "index.html")).href);
	await page.waitForFunction("typeof READY !== 'undefined' && READY && G", { timeout: 60000 });
	await page.addScriptTag({ content: api });
	const result = await page.evaluate(() => __dev.run(`(() => {
		V2=true; Rand.seed(777); newGame();
		for (let i=0;i<3;i++) G.slots[i]=recruit(HEROES[i],0);
		G.depth=12; fight('norm'); startFight();
		const units=F.pl.concat(F.en), entries=units.map(u=>({u, pair:uSet(u,0)}));
		for (const e of entries) { e.u.mv=1; e.u.hitT=0; e.u.an=null; e.u.atkT=0; }
		function run(n) {
			const start=performance.now();
			for (let i=0;i<n;i++) for (const e of entries) {
				const u=e.u; u.x+=0.05; v2AnimTrack(u);
				const f=v2AnimFrame(u,e.pair[0]); v2AnimBlend(u,e.pair[1],f,i/60); v2Pixel(u.x); v2Pixel(u.y);
			}
			return (performance.now()-start)/(n*entries.length);
		}
		run(1000); const samples=[]; for(let j=0;j<7;j++) samples.push(run(5000));
		return {units:entries.length,samplesMsPerUnit:samples,medianMsPerUnit:[...samples].sort((a,b)=>a-b)[3]};
	})()`));
	console.log(JSON.stringify({ browser: await browser.version(), cpu: 4, ...result }, null, 2));
} finally { await browser.close(); }
