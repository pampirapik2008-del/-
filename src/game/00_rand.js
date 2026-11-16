// ===== 00_rand.js =====
// ДЕТЕРМИНИРОВАННАЯ СЛУЧАЙНОСТЬ.
// Вся игровая логика (бой, карта, награды, магазин) берёт случайность только отсюда:
// прямой Math.random в src/game запрещён линтером. Благодаря этому партия
// воспроизводится по сиду, а golden-тесты ловят регрессии в поведении.
const Rand = (() => {
	// mulberry32: быстрый, без аллокаций, стабильный на всех платформах (только integer-операции)
	let s = 0x9e3779b9 >>> 0;
	const next = () => {
		s = (s + 0x6d2b79f5) >>> 0;
		let q = Math.imul(s ^ (s >>> 15), 1 | s);
		q = (q + Math.imul(q ^ (q >>> 7), 61 | q)) ^ q;
		return ((q ^ (q >>> 14)) >>> 0) / 4294967296;
	};
	return {
		next, // [0,1)
		seed(v) {
			s = (v >>> 0) || 1;
		},
		get state() {
			return s >>> 0;
		},
		set state(v) {
			s = v >>> 0;
		},
		int(n) {
			return (next() * n) | 0;
		},
		range(a, b) {
			return a + next() * (b - a);
		},
		pick(a) {
			return a[(next() * a.length) | 0];
		},
		chance(p) {
			return next() < p;
		},
	};
})();
