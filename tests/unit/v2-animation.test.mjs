import test from "node:test";
import assert from "node:assert/strict";
import { boot } from "../harness/boot.mjs";

test("V2: фаза шага зависит от расстояния, телепорт не считается шагом", async () => {
	const g = boot(); await g.ready();
	const data = JSON.parse(g.dev.run(`JSON.stringify((() => {
		const u = {x:0,y:0,team:0,mv:1,spd:5,ph:0};
		const a = {idle:["idle"],walk:["a","b","c","d"],hurt:["hit"],atk:["atk"]};
		v2AnimTrack(u); const first=v2AnimFrame(u,a);
		u.x=8; v2AnimTrack(u); const next=v2AnimFrame(u,a);
		v2AnimTrack(u); const still=v2AnimFrame(u,a);
		u.x=200; v2AnimTrack(u); const teleport=v2AnimFrame(u,a);
		u.hitT=.06; const hit=v2AnimFrame(u,a);
		return {first,next,still,teleport,hit,distance:v2AnimState(u).distance};
	})())`));
	assert.deepEqual(data, { first: "a", next: "b", still: "b", teleport: "b", hit: "hit", distance: 8 });
});
test("V2: переход настоящих кадров 100 мс и первый кадр не пропадает", async () => {
	const g = boot(); await g.ready();
	const data = JSON.parse(g.dev.run(`JSON.stringify((() => {
		const u={x:0,y:0}, img={}, a={}, b={};
		let q=v2AnimBlend(u,img,a,1); const first=[q.prev===null,q.mix];
		q=v2AnimBlend(u,img,b,1.01); const start=[q.prev===a,q.mix];
		q=v2AnimBlend(u,img,b,1.06); const middle=q.mix;
		q=v2AnimBlend(u,img,b,1.12); return {first,start,middle,end:[q.prev===null,q.mix]};
	})())`));
	assert.deepEqual(data.first, [true, 1]);
	assert.deepEqual(data.start, [true, 0]);
	assert.ok(Math.abs(data.middle - 0.5) < 1e-9);
	assert.deepEqual(data.end, [true, 1]);
});
test("V2: интерполяция не оставляет временные координаты в симуляции", async () => {
	const g = boot(); await g.ready();
	g.dev.run('V2 = true'); g.dev.newGame(); g.dev.setSlot(0, g.dev.HEROES[0]); g.dev.fight('norm'); g.dev.startFight();
	const result = JSON.parse(g.dev.run(`JSON.stringify((() => {
		const u=F.pl[0]; u.x=200; u.y=250; lerpRemember([u]); u.x=210; Loop.alpha=0.5; F.lock=0; F.out=null;
		fightLerpIn(); const during=u.x; fightLerpOut(); return {during,after:u.x};
	})())`));
	assert.deepEqual(result, { during: 205, after: 210 });
});

test("V2: снаряды не создают состояние анимации персонажей", async () => {
	const g = boot(); await g.ready();
	assert.equal(g.dev.run(`(() => {
		V2=true; const p={x:1,y:2,team:1}; lerpRemember([p], false);
		return V2_ANIM.has(p);
	})()`), false);
});
