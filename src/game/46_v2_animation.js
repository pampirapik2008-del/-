// ===== ЧАСТЬ АНИМАЦИИ V2 =====
// Данные живут вне юнита: ни сохранения, ни симуляция их не читают.
const V2_ANIM = new WeakMap();
function v2AnimState(u) {
	let q = V2_ANIM.get(u);
	if (!q) {
		q = { x: u.x, y: u.y, distance: 0, img: null, frame: null, prev: null, start: 0, last: -1, mix: 1 };
		V2_ANIM.set(u, q);
	}
	return q;
}
// Вызывается перед шагом только при V2. Шаг идёт по пути симуляции, не по частоте кадров.
function v2AnimTrack(u) {
	if (u.team === undefined) return;
	const q = v2AnimState(u), dx = u.x - q.x, dy = u.y - q.y, d2 = dx * dx + dy * dy;
	if (u.mv && d2 > 0 && d2 <= 1600) q.distance += Math.sqrt(d2);
	q.x = u.x;
	q.y = u.y;
}
function v2AnimFrame(u, A) {
	const q = v2AnimState(u);
	if (u.dead) return aFrame(A, "dead", 1);
	if (u.hitT > 0) return aFrame(A, "hurt", 1 - Math.min(1, u.hitT / 0.12));
	if (u.an) return aFrame(A, u.an.n, u.an.t / u.an.d, u.an.n === "win" ? t * 3.2 + u.ph : undefined);
	if (u.jump) return aFrame(A, "jump", 0, t * 6 + u.ph);
	if (u.dodgeT > 0) return aFrame(A, "dodge", 0, t * 8 + u.ph);
	if (u.atkT > 0) return aFrame(A, "atk", 1 - u.atkT / u.atkD);
	if (u.mv) return aFrame(A, u.spd >= 7 && A.run ? "run" : "walk", 0, q.distance / 8);
	return aFrame(A, "idle", 0, t * 2.3 + u.ph);
}
// Без выделений на каждом кадре: смешиваем только настоящие кадры выбранного атласа.
function v2AnimBlend(u, img, frame, now) {
	const q = v2AnimState(u);
	if (q.img !== img || now < q.last || now - q.last > 0.3) {
		q.img = img; q.frame = frame; q.prev = null; q.start = now;
	} else if (q.frame !== frame) {
		q.prev = q.frame; q.frame = frame; q.start = now;
	}
	q.last = now;
	q.mix = Math.min(1, Math.max(0, (now - q.start) / 0.1));
	if (q.mix >= 1) q.prev = null;
	if (!q.prev) q.mix = 1;
	return q;
}
// Координаты округляются к физическим пикселям с учётом масштаба окна, DPR и камеры.
function v2Pixel(x) {
	const size = Math.min(Math.max(innerWidth, innerHeight) / W, Math.min(innerWidth, innerHeight) / H);
	const scale = Math.max(0.01, size * (window.devicePixelRatio || 1) * CAM.z);
	return Math.round(x * scale) / scale;
}
