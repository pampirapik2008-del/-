import test from "node:test";
import assert from "node:assert/strict";
import { boot } from "../harness/boot.mjs";
import { createDom } from "../harness/dom.mjs";

function start(defaultOn, config) {
	const dom = createDom();
	dom.windowObj.__mxV2Default = defaultOn;
	if (config) dom.windowObj.__mxStorage.setItem("monsterAwakeningCfg", JSON.stringify(config));
	return boot({ dom });
}
test("V2: значение сборки не перекрывает сохранённый выбор", () => {
	assert.equal(start(false).dev.run("V2"), false);
	assert.equal(start(true).dev.run("V2"), true);
	assert.equal(start(true, { v2: false }).dev.run("V2"), false);
	assert.equal(start(false, { v2: true }).dev.run("V2"), true);
	assert.equal(start(true, { v2: "false" }).dev.run("V2"), true);
});
test("V2: настройки сохраняются отдельно и не меняют старую тряску", () => {
	const g = start(false, { shake: true });
	g.dev.run('v2Set("v2", true); v2Set("v2Hit", false); v2Set("v2Dust", false); v2Set("v2Camera", false)');
	const cfg = JSON.parse(g.readStorage("monsterAwakeningCfg"));
	assert.equal(cfg.v2, true);
	assert.equal(cfg.v2Hit, false);
	assert.equal(cfg.v2Dust, false);
	assert.equal(cfg.v2Camera, false);
	assert.equal(cfg.shake, true);
	g.dev.run('v2Set("v2", false); v2Set("unknown", true)');
	assert.equal(g.dev.run("V2"), false);
	assert.equal(JSON.parse(g.readStorage("monsterAwakeningCfg")).v2Hit, false);
	assert.equal(g.dev.run('Object.hasOwn(CFG,"unknown")'), false);
});
