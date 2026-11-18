// Правила линтера: длина функций (модуль-замыкание — пространство имён, меряем его внутренности)
// и мёртвый код (объявление верхнего уровня без единой ссылки).
import test from "node:test";
import assert from "node:assert/strict";
import { longFunctions, deadDeclarations, duplicateDeclarations, forbidden } from "../../tools/lint.mjs";

const body = (n) => Array.from({ length: n }, (_, i) => `\tx += ${i};`).join("\n");

test("длинная функция верхнего уровня и длинный метод объекта попадают в список", () => {
	const text = `function short() {\n${body(3)}\n}\nfunction long() {\n${body(130)}\n}\nconst O = {\n\tm() {\n${body(125)}\n\t},\n};\n`;
	const out = longFunctions(text, 120);
	assert.deepEqual(
		out.map((f) => f.name),
		["long", "m"]
	);
	assert.equal(out[0].len, 132);
});

test("модуль-замыкание не считается одной функцией — проверяются функции внутри него", () => {
	const inner = `\tfunction a() {\n${body(10)}\n\t}\n\tfunction tooLong() {\n${body(130)}\n\t}\n`;
	const text = `const Mod = (() => {\n${inner}\treturn { a };\n})();\n`;
	const out = longFunctions(text, 120);
	assert.deepEqual(
		out.map((f) => f.name),
		["tooLong"],
		"сам Mod (≈150 строк) не в списке, а длинная внутренняя функция — в списке"
	);
	// обычная стрелка в const по-прежнему меряется целиком
	const arrow = `const f = (a) => {\n${body(130)}\n};\n`;
	assert.deepEqual(
		longFunctions(arrow, 120).map((f) => f.name),
		["f"]
	);
});

test("мёртвый код: объявление без ссылок — находится; ссылка в комментарии не считается; обвязка считается", () => {
	const texts = [
		{ file: "a.js", text: "function used() {}\nfunction unused() {}\nconst TABLE = { a: 1 };\nlet counter = 0;\nconst onlyInComment = 1;\nconst __lever = 2;\n" },
		{ file: "b.js", text: "used(); counter++;\n// onlyInComment упоминается только здесь\n/* и здесь: onlyInComment */\n" },
	];
	assert.deepEqual(
		deadDeclarations(texts).map((d) => d.file + ":" + d.name),
		["a.js:unused", "a.js:TABLE", "a.js:onlyInComment"],
		"__lever — рычаг обвязки, не считается"
	);
	assert.deepEqual(
		deadDeclarations(texts, "unused(); TABLE.a;").map((d) => d.name),
		["onlyInComment"],
		"ссылка из devapi/обвязки делает объявление живым"
	);
});

test("что считается ссылкой: свойство через точку и часть другого имени — нет, ключ объекта — да (консервативно)", () => {
	const texts = [{ file: "a.js", text: "function go() {}\nfunction run() {}\nfunction goNow() {}\nfunction key() {}\ngoNow();\no.go;\nx.run();\nconst o = { key: 1 };\n" }];
	assert.deepEqual(
		deadDeclarations(texts).map((d) => d.name),
		["go", "run"],
		"o.go, x.run() и goNow — не ссылки на go/run; ключ key: оставляет key живым"
	);
});

test("экран вне 12_state.js: сравнения и присваивания S запрещены, Machine.is/go — нет", () => {
	const bad = forbidden("50_draw.js", 'if (S === "fight") x();\nif (S !== "map" || paused) y();\nS = "menu";\nif (Machine.is("fight")) z();\nconst s = obj.S === "x"; // чужое поле S — не экран\n');
	assert.deepEqual(
		bad.map((b) => b.line),
		[1, 2, 3]
	);
	assert.match(bad[0].msg, /Machine\.is/);
	assert.match(bad[2].msg, /Machine\.go/);
	// внутри модуля состояния те же строки разрешены
	assert.deepEqual(forbidden("12_state.js", 'if (S === "fight") x();\nS = "menu";\n'), []);
	// комментарии не считаются
	assert.deepEqual(forbidden("60_game.js", '// раньше тут было S === "map"\n'), []);
	assert.equal(forbidden("60_game.js", "const r = Math.random();\n")[0].msg.includes("Rand"), true);
});

test("дубли объявлений верхнего уровня: одно имя в двух файлах или дважды в одном — ошибка с указанием первого места", () => {
	const texts = [
		{ file: "a.js", text: "function bakeLakes(x) {\n}\nlet seed = 7;\nconst rn = () => 1;\n" },
		{ file: "b.js", text: "// function bakeLakes — не объявление\nfunction bakeLakes(x, im) {\n}\nclass Foo {}\nvar seed = 1;\nclass Foo {}\n" },
	];
	assert.deepEqual(
		duplicateDeclarations(texts).map((d) => `${d.file}:${d.line} ${d.name} <- ${d.firstFile}:${d.firstLine}`),
		["b.js:2 bakeLakes <- a.js:1", "b.js:5 seed <- a.js:3", "b.js:6 Foo <- b.js:4"]
	);
	// вложенные объявления (с отступом) не считаются верхним уровнем
	assert.deepEqual(duplicateDeclarations([{ file: "c.js", text: "function f() {\n\tconst x = 1;\n}\nfunction g() {\n\tconst x = 2;\n}\n" }]), []);
});

