#!/usr/bin/env node
// Разница двух снимков кучи V8 (.heapsnapshot): что выросло между «после прогрева» и «в конце».
// Группирует узлы по типу и имени конструктора, считает число и собственный размер, печатает
// самые выросшие группы. Снимки пишет tools/soak.mjs --heap-snapshots DIR.
//   node tools/heapdiff.mjs DIR/warm.heapsnapshot DIR/end.heapsnapshot [--top 25]
import fs from "node:fs";

const [a, b] = process.argv.slice(2).filter((x) => !x.startsWith("--"));
const topI = process.argv.indexOf("--top");
const TOP = topI > 0 ? Number(process.argv[topI + 1]) : 25;
if (!a || !b) {
	console.error("нужны два файла .heapsnapshot");
	process.exit(2);
}

function aggregate(file) {
	const snap = JSON.parse(fs.readFileSync(file, "utf8"));
	const fields = snap.snapshot.meta.node_fields,
		types = snap.snapshot.meta.node_types[0],
		N = fields.length,
		iType = fields.indexOf("type"),
		iName = fields.indexOf("name"),
		iSize = fields.indexOf("self_size"),
		nodes = snap.nodes,
		strings = snap.strings,
		out = new Map();
	let total = 0;
	for (let i = 0; i < nodes.length; i += N) {
		const t = types[nodes[i + iType]],
			nm = strings[nodes[i + iName]],
			sz = nodes[i + iSize];
		// строки и массивы группируем по типу, объекты — по конструктору
		const key = t === "object" || t === "closure" || t === "native" ? t + " " + nm : t === "string" || t === "concatenated string" || t === "sliced string" ? "string" : t;
		const e = out.get(key) || { n: 0, size: 0 };
		e.n++;
		e.size += sz;
		out.set(key, e);
		total += sz;
	}
	return { out, total, count: nodes.length / N };
}

const A = aggregate(a),
	B = aggregate(b);
const keys = new Set([...A.out.keys(), ...B.out.keys()]);
const rows = [];
for (const k of keys) {
	const x = A.out.get(k) || { n: 0, size: 0 },
		y = B.out.get(k) || { n: 0, size: 0 };
	rows.push({ k, dn: y.n - x.n, ds: y.size - x.size, n: y.n, size: y.size });
}
rows.sort((p, q) => q.ds - p.ds);
const kb = (v) => (v / 1024).toFixed(1).padStart(9) + " КБ";
console.log(`всего: ${(A.total / 1048576).toFixed(2)} → ${(B.total / 1048576).toFixed(2)} МБ, узлов ${A.count} → ${B.count}`);
console.log("самые выросшие группы (Δ размер, Δ число, итог):");
for (const r of rows.slice(0, TOP)) console.log(`  ${kb(r.ds)}  ${String(r.dn).padStart(7)} шт  (итого ${kb(r.size)}, ${r.n} шт)  ${r.k}`);
