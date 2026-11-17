// ===== 20_data.js =====
// ===== ДАННЫЕ: редкости, стихии, реликвии, герои, 10 миров, враги и боссы =====
const RAR = [
	{ n: "Обычная", c: "#9aa0aa", m: 1, um: 1 },
	{ n: "Необычная", c: "#54b25c", m: 1.5, um: 1.12 },
	{ n: "Редкая", c: "#4294e8", m: 2.2, um: 1.25 },
	{ n: "Эпическая", c: "#aa60f0", m: 3.2, um: 1.45 },
	{ n: "Легендарная", c: "#ffb828", m: 4.5, um: 1.7 },
	{ n: "Мифическая", c: "#ff466e", m: 6.5, um: 2 },
	{ n: "Секретная", c: "#5ff0e0", m: 9, um: 2.6 },
];
// ---------- баланс: числа логики в одном месте ----------
// Логика боя, лавки, наград и врагов читает отсюда. Значения ровно те, что раньше были
// рассыпаны по коду (сверка — tests/unit/data.test.mjs, поведение — golden-эталон).
const BAL = {
	fight: {
		timer: 110, // секунд на обычный бой
		bossTimer: 200, // секунд на босса
		timeoutEdge: 0.05, // по таймеру побеждает отряд, если его доля HP выше вражеской на столько
		subStep: 0.025, // максимальный подшаг симуляции, с
		maxSub: 16, // подшагов за один вызов upd
		outWin: 1.5, // пауза до экрана победы, с
		outWinBoss: 3.1,
		outLose: 1.3, // пауза до экрана поражения / исхода по таймеру
	},
	dmg: {
		armK: 100, // урон × armK / (armK + броня)
		critHero: 0.06, // базовый шанс крита бойца (если у набора нет своего)
		critFoe: 0.05, // шанс крита врага
		critMul: 1.8,
		shockMul: 1.15, // множитель урона по цели в шоке
		enMax: 100, // энергия ульты
		enHit: 8, // энергия атакующему за удар
		enTaken: 4, // энергия цели за полученный удар
		enTick: 2.2, // пассивная энергия бойца в секунду
		dotTick: 0.5, // период тика горения/яда, с
		hazTick: 0.5, // период проверки опасных покрытий, с
		hazDmg: 0.015, // доля max HP за тик покрытия
		hazDmgBoss: 0.004,
		hazSt: 0.006, // сила статуса от покрытия (доля max HP)
		poolDmg: 0.3, // доля атаки хозяина лужи за тик
		curseHeal: 0.5, // лечение под проклятием
		soulHeal: 0.05, // «души» (погода): доля max HP убийце
		skullCoin: 8, // монет за врага с черепом
	},
	rar: {
		w: [52, 27, 14, 5.2, 1.5, 0.3, 0.08], // веса редкостей 0..6
		luckK: 0.28, // удача сдвигает веса: w_i × (1 + luck × luckK)^i
	},
	shop: {
		relPrice: [8, 12, 18, 28, 45, 80, 140], // цена реликвии по редкости
		relPriceW: 2, // + столько за каждый пройденный мир
		rrBase: 3, // цена обновления товара
		rrStep: 2, // + столько за каждое обновление
		stock: 3, // реликвий на витрине
	},
	foe: {
		hpK: 1.14, // рост HP врагов по мирам
		atkK: 1.12, // рост атаки
		armK: 0.2, // рост брони: × (1 + armK × мир)
		bossHp: 0.25, // доля базового HP босса в первом мире
		bossHpK: 1.3, // рост HP босса по мирам
	},
	win: {
		healFloor: 0.25, // после победы HP не ниже этой доли max
		healBonus: 0.2, // + столько от max
		arenaCoin: 8, // монеты за волну арены: arenaCoin + arenaCoinWave × волна
		arenaCoinWave: 2,
		bossCoin: 20, // монеты за босса (× cmul)
		bossMeat: 3, // мясо за босса: bossMeat + мир
		fightCoin: 6, // монеты за обычный бой: (fightCoin + глубина) × cmul
		arenaNodeCoin: 10, // монеты за узел «Арена»
		relicChance: 0.14, // шанс реликвии после обычного боя
		swampRelicChance: 0.4, // после логова
	},
};
// бросок редкости: luck сдвигает шансы вверх, min — нижняя граница
function rollRar(luck = 0, min = 0, rnd01 = Rand.next) {
	const w = BAL.rar.w.map((v, i) => (i < min ? 0 : v * Math.pow(1 + luck * BAL.rar.luckK, i)));
	let s = w.reduce((a, b) => a + b, 0) * rnd01();
	for (let i = 0; i < 7; i++) if ((s -= w[i]) <= 0) return i;
	return min;
}
const EL = {
	phys: { c: "#ffffff", c2: "#ffe9a8" },
	nature: { c: "#8be06a", c2: "#e2ffb0" },
	fire: { c: "#ff8a3c", c2: "#ffe27a", st: "burn" },
	ice: { c: "#9fe8ff", c2: "#ffffff", st: "chill" },
	poison: { c: "#9be04e", c2: "#e0ff8a", st: "poison" },
	bolt: { c: "#fff27a", c2: "#ffffff", st: "shock" },
	dark: { c: "#b06cff", c2: "#e9d0ff", st: "curse" },
	holy: { c: "#fff3b0", c2: "#ffffff" },
	prism: { c: "#ff8af0", c2: "#b0f4ff", st: "shock" },
	chaos: { c: "#ff4fd8", c2: "#5ff0e0", st: "rnd" },
};
const STN = { burn: "Горение", poison: "Яд", chill: "Холод", shock: "Шок", curse: "Проклятие", stun: "Оглушение", shield: "Щит", rage: "Ярость" };

// ---------- реликвии: общие пассивки отряда. st — меняет характеристики (как значки), p — эффект в бою ----------
const RELIC = {
	fang: { n: "Клык вожака", st: (u, m) => (u.atk = Math.round(u.atk * (1 + 0.08 * m))), d: (m) => `Атака отряда +${pct(0.08 * m)}`, cmp: "atk" },
	shell: { n: "Каменный панцирь", st: (u, m) => (u.arm += Math.round(6 * m)), d: (m) => `Броня отряда +${Math.round(6 * m)}`, cmp: "arm" },
	heart: {
		n: "Амулет жизни",
		st: (u, m) => {
			const x = Math.round(u.max * (1 + 0.1 * m));
			u.hp += x - u.max;
			u.max = x;
		},
		d: (m) => `Здоровье отряда +${pct(0.1 * m)}`,
		cmp: "max",
	},
	boots: { n: "Сапоги ветра", st: (u, m) => (u.spd = +(u.spd + 0.6 * m).toFixed(1)), d: (m) => `Скорость отряда +${(0.6 * m).toFixed(1)}`, cmp: "spd" },
	hourglass: { n: "Песочные часы", st: (u, m) => (u.aspd = +(u.aspd * (1 + 0.06 * m)).toFixed(2)), d: (m) => `Скорость атаки +${pct(0.06 * m)}`, cmp: "aspd" },
	blood: { n: "Кровавая капля", p: "ls", v: (m) => 0.04 * m, d: (m) => `Вампиризм: ${pct(0.04 * m)} урона лечит бьющего` },
	thunder: { n: "Громовой камень", p: "chain", v: (m) => 0.3 * m, d: (m) => `Криты бьют молнией ещё по 2 врагам (${pct(0.3 * m)} урона)` },
	vial: { n: "Ядовитая железа", p: "psn", v: (m) => 0.05 * m, d: (m) => `Атаки отравляют: ${pct(0.05 * m)} атаки в секунду, 3 с` },
	frost: { n: "Ледяное сердце", p: "frz", v: (m) => Math.min(0.4, 0.06 * m), d: (m) => `Шанс ${pct(Math.min(0.4, 0.06 * m))} заморозить врага на 1 с` },
	flame: { n: "Огненная руна", p: "abil", v: (m) => 0.15 * m, d: (m) => `Урон способностей и ульт +${pct(0.15 * m)}` },
	ward: { n: "Щит духа", p: "ward", v: (m) => 0.08 * m, d: (m) => `В начале боя каждый получает щит ${pct(0.08 * m)} здоровья` },
	clover: { n: "Клевер удачи", p: "crit", v: (m) => 0.04 * m, d: (m) => `Шанс крита +${pct(0.04 * m)}` },
	crown: { n: "Корона жадности", p: "coin", v: (m) => Math.round(2 * m), d: (m) => `+${Math.round(2 * m)} монет за каждую победу` },
	skull: { n: "Череп предков", p: "avg", v: (m) => 0.1 * m, d: (m) => `Гибель союзника: атака остальных +${pct(0.1 * m)} до конца боя` },
	eye: { n: "Око хаоса", p: "chg", v: (m) => 0.1 * m, d: (m) => `Ульта заряжается на ${pct(0.1 * m)} быстрее` },
	feather: { n: "Перо феникса", p: "phx", v: (m) => Math.min(1, 0.2 * m), d: (m) => `Раз за бой воскрешает павшего с ${pct(Math.min(1, 0.2 * m))} здоровья` },
	tome: { n: "Древний фолиант", p: "cdr", v: (m) => Math.min(0.6, 0.06 * m), d: (m) => `Перезарядка способностей −${pct(Math.min(0.6, 0.06 * m))}` },
	blade: { n: "Клинок палача", p: "crd", v: (m) => 0.15 * m, d: (m) => `Урон критов +${pct(0.15 * m)}` },
};
const RELIC_IDS = Object.keys(RELIC);
const relPrice = (r, w) => BAL.shop.relPrice[r] + (w || 0) * BAL.shop.relPriceW;
// суммарные боевые бонусы отряда от реликвий
function relBonus() {
	const b = { ls: 0, chain: 0, psn: 0, frz: 0, abil: 0, ward: 0, crit: 0, coin: 0, avg: 0, chg: 0, phx: 0, cdr: 0, crd: 0 };
	((G && G.rel) || []).forEach((q) => {
		const d = RELIC[q.id];
		if (d && d.p) b[d.p] += d.v(RAR[q.r].m);
	});
	b.frz = Math.min(0.5, b.frz);
	b.cdr = Math.min(0.6, b.cdr);
	b.phx = Math.min(1, b.phx);
	return b;
}
// применить характеристики всех реликвий и значков к новому бойцу (как делал оригинал со значками)
function applyPerks(u) {
	Object.keys(G.bf).forEach((k) => {
		for (let i = 0; i < G.bf[k]; i++) bf(k, u);
	});
	(G.rel || []).forEach((q) => {
		const d = RELIC[q.id];
		if (d && d.st) d.st(u, RAR[q.r].m);
	});
}

// ---------- герои: способность + ульта ----------
HEROES[2].k = "paladin";
const KIT = {
	mage: {
		role: "Лекарь",
		crit: 0.06,
		el: "nature",
		ab: { n: "Колючий корень", cd: 8, d: "Оплетает ближайшего врага: 120% атаки и оглушение на 1.5 с." },
		ult: { n: "Дыхание леса", d: "Лечит отряд на 25% здоровья и бьёт всех врагов духами леса (150% атаки)." },
	},
	knight: {
		role: "Воин",
		crit: 0.08,
		el: "holy",
		ab: { n: "Рассечение", cd: 6, d: "Удар по дуге: 140% атаки всем врагам перед собой и отбрасывание." },
		ult: { n: "Клинок рассвета", d: "Прыжок и удар мечом света: 400% атаки по области, оглушение 1.5 с." },
	},
	paladin: {
		role: "Защитник",
		crit: 0.05,
		el: "holy",
		ab: { n: "Святой щит", cd: 9, d: "Щит себе и самому раненому союзнику, враги рядом переключаются на паладина." },
		ult: { n: "Божественный суд", d: "Столп света: отряд неуязвим 2 с и лечится на 15%, врагам рядом — 250% атаки." },
	},
	bandit: {
		role: "Убийца",
		crit: 0.2,
		el: "phys",
		ab: { n: "Подлый удар", cd: 5, d: "Рывок за спину самому слабому врагу и гарантированный крит." },
		ult: { n: "Вихрь ударов", d: "6 молниеносных ударов по случайным врагам (90% атаки), сам в это время неуязвим." },
	},
	frost: {
		role: "Защитник",
		crit: 0.05,
		el: "ice",
		ab: { n: "Ледяной удар", cd: 7, d: "Удар ледяным клинком: 130% атаки и замедление (холод) на 2.5 с." },
		ult: { n: "Метель", d: "Метель: 250% атаки всем врагам рядом и заморозка на 1 с." },
	},
	pyro: {
		role: "Воин",
		crit: 0.08,
		el: "fire",
		ab: { n: "Огненный удар", cd: 6, d: "Удар лавовым топором: 140% атаки и поджог на 3 с." },
		ult: { n: "Вулкан", d: "Прыжок в гущу врагов: 350% атаки по области и поджог." },
	},
	necro: {
		role: "Маг",
		crit: 0.06,
		el: "dark",
		ab: { n: "Проклятие", cd: 8, d: "Проклинает ближайшего врага: 120% атаки и проклятие на 4 с." },
		ult: { n: "Армия теней", d: "Тени бьют всех врагов: 200% атаки и проклятие всем." },
	},
	volt: {
		role: "Маг",
		crit: 0.1,
		el: "bolt",
		ab: { n: "Цепная молния", cd: 6, d: "Молния перескакивает на 3 врагов: 110% атаки каждому." },
		ult: { n: "Буря", d: "Гроза: 5 разрядов по случайным врагам (120% атаки) и шок." },
	},
	druid: {
		role: "Лекарь",
		crit: 0.05,
		el: "nature",
		ab: { n: "Корни", cd: 8, d: "Оплетает врага: 110% атаки и оглушение на 1.5 с." },
		ult: { n: "Дыхание леса", d: "Лечит отряд на 20% здоровья и бьёт врагов корнями (140% атаки)." },
	},
	shade: {
		role: "Убийца",
		crit: 0.25,
		el: "dark",
		ab: { n: "Исчезновение", cd: 7, d: "Исчезает и бьёт самого слабого врага с гарантированным критом (130% атаки)." },
		ult: { n: "Танец теней", d: "6 ударов по случайным врагам (90% атаки), сам в это время неуязвим." },
	},
	golem: {
		role: "Танк",
		crit: 0.05,
		el: "phys",
		ab: { n: "Каменный щит", cd: 9, d: "Щит себе и раненому союзнику (20% здоровья), враги рядом переключаются на голема." },
		ult: { n: "Сокрушение", d: "Ударная волна: 300% атаки по области и оглушение на 1.5 с." },
	},
	archer: {
		role: "Стрелок",
		crit: 0.15,
		el: "nature",
		ab: { n: "Меткий выстрел", cd: 5, d: "Выстрел с гарантированным критом: 180% атаки." },
		ult: { n: "Дождь стрел", d: "Залп: 6 стрел по случайным врагам (110% атаки)." },
	},
	prism: {
		role: "Маг",
		crit: 0.08,
		el: "prism",
		ab: { n: "Преломление", cd: 7, d: "Луч по линии: 150% атаки всем врагам перед собой." },
		ult: { n: "Призма", d: "Мощный луч: 320% атаки по области и шок." },
	},
	vamp: {
		role: "Воин",
		crit: 0.12,
		el: "dark",
		ab: { n: "Кровавый удар", cd: 6, d: "Удар рапирой: 130% атаки, половина урона лечит вампира." },
		ult: { n: "Кровавый шторм", d: "5 ударов по случайным врагам (110% атаки), лечится на 30% урона." },
	},
};

// ---------- миры ----------
const GREEN_H = [70, 170],
	RED_H = [325, 25];
const FIRE0 = ["#fff3b0", "#ffd45e", "#ff8a3c", "#c8401c"];
const WORLDS = [
	{
		id: "taiga",
		n: "Тайга",
		sub: "Туман, костры и первые слизни",
		fy0: 228,
		amb: ["#d6d9e6", "#a3abcf", "#737bad"],
		wx: ["clear", "needles", "fog", "rain", "storm"],
		big: ["spruce", "spruce", "pillar", "wall", "boulder"],
		small: ["rocks", "stump", "log"],
		destr: ["stump", "log", "shrooms"],
		light: ["campfire", "lantern"],
		decor: ["fern", "pebble", "shrooms", "pebble"],
		patch: ["dirt", "moss"],
		el: "nature",
		foes: ["Зеленый слизень", "Болотный слизень", "Красный слизень"],
		tM: { to: 158, sat: 0.75, val: 0.62 },
		boss: { n: "Король слизней", n2: "Багровый король", p1: ["slam", "summon"], p2: ["slam", "volley", "summon"] },
		ui: "#7be07b",
		mus: 0,
	},
	{
		id: "desert",
		n: "Пустыня",
		sub: "Руины, зной и песчаные вихри",
		fy0: 240,
		amb: ["#fff4de", "#ffdcae", "#bda6cc"],
		wx: ["clear", "heat", "sandstorm"],
		sfx: "_sand",
		big: ["pillar_sand", "wall_sand", "boulder_sand", "pillar_sand"],
		small: ["rocks_sand", "stump", "log"],
		destr: ["stump", "log"],
		light: ["campfire", "lantern"],
		decor: ["fern_sand", "pebble_sand", "pebble_sand"],
		patch: ["tiles", "pit"],
		el: "fire",
		foes: ["Песчаный слизень", "Барханный слизень", "Скорпионий шипач"],
		tA: { to: 44, sat: 0.62, val: 1.05 },
		tB: { to: 24, sat: 0.9, val: 0.95 },
		boss: { n: "Песчаный владыка", n2: "Бархан-пожиратель", p1: ["wave", "summon"], p2: ["rain", "wave", "pools"] },
		ui: "#ffc861",
		mus: 1,
	},
	{
		id: "ice",
		n: "Ледяное царство",
		sub: "Сияние, метель и вечный лёд",
		fy0: 258,
		amb: ["#e4ecff", "#aebcf0", "#848cd0"],
		wx: ["snow", "blizzard", "clear"],
		sfx: "_ice",
		big: ["snowfir", "pillar_ice", "wall_ice", "boulder_ice", "snowfir"],
		small: ["rocks_ice", "log_ice"],
		destr: ["log_ice", "shrooms_ice"],
		light: ["campfire", "lantern"],
		decor: ["fern_ice", "pebble_ice", "pebble_ice"],
		patch: ["sheet", "drift"],
		el: "ice",
		foes: ["Ледяной слизень", "Снежный слизень", "Морозный шипач"],
		tA: { to: 192, sat: 0.6, val: 1.12 },
		tB: { to: 226, sat: 0.75, val: 1.05 },
		boss: { n: "Ледяной король", n2: "Ледяной тиран", p1: ["volley", "slam"], p2: ["rain", "pools", "shield"] },
		ui: "#9fe8ff",
		mus: 2,
	},
	{
		id: "fire",
		n: "Огненные пустоши",
		sub: "Лава, пепел и огненные трещины",
		fy0: 250,
		amb: ["#ffd4b8", "#d48e7c", "#8e5e6e"],
		wx: ["ash", "eruption", "clear"],
		pt: [
			{ gray: 1, to: 18, sat: 0.3, val: 0.55 },
			{ h: [60, 180], to: 22, sat: 1.2, val: 1.25 },
		],
		big: ["pillar", "wall", "boulder", "boulder"],
		small: ["rocks", "log"],
		destr: ["log", "stump"],
		light: ["campfire", "lantern"],
		decor: ["pebble", "pebble"],
		patch: ["lava", "ashp"],
		el: "fire",
		fire: ["#fff3b0", "#ffb03c", "#ff5a1c", "#901808"],
		foes: ["Магмовый слизень", "Шлаковый слизень", "Пепельный шипач"],
		tA: { to: 18, sat: 1.1, val: 1.1 },
		tB: { to: 12, sat: 0.35, val: 0.5 },
		boss: { n: "Магмовый владыка", n2: "Сердце вулкана", p1: ["pools", "slam"], p2: ["rain", "volley", "pools"] },
		ui: "#ff8a3c",
		mus: 3,
	},
	{
		id: "swamp",
		n: "Болото",
		sub: "Тёмная вода и ядовитый туман",
		fy0: 236,
		amb: ["#b6d6c6", "#8aaca4", "#5e748c"],
		wx: ["fog", "rain", "spores"],
		pt: [
			{ gray: 1, to: 150, sat: 0.22, val: 0.75 },
			{ h: [60, 180], to: 140, sat: 0.9, val: 0.7 },
		],
		big: ["spruce", "wall", "boulder"],
		small: ["rocks", "stump", "log"],
		destr: ["stump", "log", "shrooms"],
		light: ["shrooms", "lantern"],
		decor: ["fern", "shrooms", "pebble"],
		patch: ["bog", "toxic"],
		el: "poison",
		fire: ["#f0ffb0", "#b8ff5e", "#5ad03c", "#207818"],
		foes: ["Ядовитый слизень", "Тинный слизень", "Трясинный шипач"],
		tA: { to: 78, sat: 1.1, val: 1.1 },
		tB: { to: 286, sat: 0.7, val: 0.8 },
		boss: { n: "Трясинный король", n2: "Чумной владыка", p1: ["volley", "summon"], p2: ["pools", "summon", "rain"] },
		ui: "#9be04e",
		mus: 4,
	},
	{
		id: "sky",
		n: "Небесные острова",
		sub: "Облака, водопады и ветер",
		fy0: 282,
		amb: ["#ffffff", "#f2eaff", "#cac2f2"],
		wx: ["clear", "wind", "storm"],
		pt: [{ gray: 1, to: 210, sat: 0.08, val: 1.35 }],
		big: ["pillar", "wall", "boulder", "pillar"],
		small: ["rocks"],
		destr: ["stump", "log"],
		light: ["lantern"],
		decor: ["fern", "pebble"],
		patch: ["tiles", "moss"],
		el: "bolt",
		foes: ["Облачный слизень", "Туманный слизень", "Грозовой шипач"],
		tA: { to: 205, sat: 0.22, val: 1.3 },
		tB: { to: 240, sat: 0.7, val: 1 },
		boss: { n: "Грозовой король", n2: "Око бури", p1: ["rain", "wave"], p2: ["rain", "volley", "shield"] },
		ui: "#bfe6ff",
		mus: 5,
	},
	{
		id: "dead",
		n: "Мёртвые земли",
		sub: "Кости, руины и зелёный туман",
		fy0: 280,
		amb: ["#bccabc", "#8e9c9a", "#5e667a"],
		wx: ["fog", "wisps", "clear"],
		pt: [
			{ gray: 1, to: 260, sat: 0.1, val: 0.8 },
			{ h: [60, 180], to: 70, sat: 0.3, val: 0.6 },
		],
		big: ["pillar", "wall", "boulder"],
		small: ["rocks", "stump", "log"],
		destr: ["stump", "log"],
		light: ["lantern", "campfire"],
		decor: ["pebble", "fern_sand"],
		patch: ["ashp", "dirt"],
		el: "dark",
		fire: ["#e0ffe0", "#8effa0", "#3cd070", "#187840"],
		foes: ["Костяной слизень", "Прахоед", "Могильный шипач"],
		tA: { to: 60, sat: 0.16, val: 1.15 },
		tB: { to: 150, sat: 0.4, val: 0.7 },
		boss: { n: "Костяной король", n2: "Владыка праха", p1: ["summon", "volley"], p2: ["summon", "wave", "drain"] },
		ui: "#a8e0b0",
		mus: 6,
	},
	{
		id: "crystal",
		n: "Кристальные пещеры",
		sub: "Сияющие минералы и отражения",
		fy0: 282,
		amb: ["#ccbcff", "#9e8ce4", "#6e5cb4"],
		wx: ["sparkle", "resonance", "clear"],
		pt: [
			{ gray: 1, to: 275, sat: 0.5, val: 1.1 },
			{ h: [60, 180], to: 185, sat: 1, val: 1.3 },
		],
		big: ["pillar", "boulder", "wall", "boulder"],
		small: ["rocks"],
		destr: ["shrooms", "log"],
		light: ["shrooms", "lantern"],
		decor: ["pebble", "pebble"],
		patch: ["sheet", "dirt"],
		el: "prism",
		fire: ["#ffffff", "#b0f4ff", "#5ac8ff", "#3050c8"],
		foes: ["Кристальный слизень", "Кварцевый слизень", "Аметистовый шипач"],
		tA: { to: 312, sat: 0.75, val: 1.1 },
		tB: { to: 268, sat: 0.85, val: 1 },
		boss: { n: "Кристальный король", n2: "Призматический колосс", p1: ["volley", "shield"], p2: ["rain", "slam", "volley"] },
		ui: "#ff8af0",
		mus: 7,
	},
	{
		id: "chaos",
		n: "Измерение хаоса",
		sub: "Искажённое пространство и порталы",
		fy0: 262,
		amb: ["#e4b4ff", "#b484e4", "#8454b4"],
		wx: ["flux", "glitch", "clear"],
		pt: [
			{ gray: 1, to: 300, sat: 0.45, val: 0.8 },
			{ h: [60, 180], to: 175, sat: 1.1, val: 1.2 },
		],
		big: ["pillar", "wall", "boulder"],
		small: ["rocks", "log"],
		destr: ["log", "shrooms"],
		light: ["shrooms", "lantern"],
		decor: ["pebble"],
		patch: ["lava", "bog"],
		el: "chaos",
		fire: ["#ffffff", "#ff9cf0", "#e040d0", "#7010a0"],
		foes: ["Слизень хаоса", "Искажённый слизень", "Осколок бездны"],
		tA: { to: 280, sat: 1, val: 0.85 },
		tB: { to: 176, sat: 0.9, val: 0.9 },
		boss: { n: "Король хаоса", n2: "Разлом", p1: ["rain", "volley", "summon"], p2: ["wave", "rain", "pools", "volley"] },
		ui: "#ff4fd8",
		mus: 8,
	},
	{
		id: "final",
		n: "Последний мир",
		sub: "Древние врата и мистический свет",
		fy0: 268,
		amb: ["#acbcec", "#7c8ccc", "#545ca4"],
		wx: ["motes", "eclipse", "storm"],
		pt: [
			{ gray: 1, to: 230, sat: 0.3, val: 0.6 },
			{ h: [60, 180], to: 46, sat: 0.9, val: 1.2 },
		],
		big: ["pillar", "wall", "boulder", "pillar"],
		small: ["rocks"],
		destr: ["log", "stump"],
		light: ["campfire", "lantern"],
		decor: ["pebble"],
		patch: ["tiles", "ashp"],
		el: "dark",
		fire: ["#ffffff", "#c0f0ff", "#60b0ff", "#2040c0"],
		foes: ["Тёмный слизень", "Слизень бездны", "Страж врат"],
		tA: { to: 235, sat: 0.55, val: 0.45 },
		tB: { to: 46, sat: 0.8, val: 0.75 },
		boss: { n: "Пробудитель", n2: "Пробуждённый", n3: "Первородный", p1: ["slam", "volley", "summon"], p2: ["rain", "wave", "pools", "shield"], p3: ["slam", "rain", "volley", "wave", "drain"] },
		ui: "#ffd27a",
		mus: 9,
	},
];
WORLDS.forEach((w, i) => {
	w.i = i;
	w.stage = "stage_" + w.id;
});
// сколько миров реально готово к игре (есть нарисованная арена)
const worldCount = () => {
	let n = 0;
	while (n < WORLDS.length && IMG[WORLDS[n].stage]) n++;
	return Math.max(1, n);
};
const WX = {
	clear: { n: "Ясно", d: "" },
	leaves: { n: "Листопад", d: "" },
	needles: { n: "Хвоя", d: "" },
	fog: { n: "Туман", d: "Дальность атак у всех −15%", rng: 0.85 },
	rain: { n: "Дождь", d: "Горение гаснет вдвое быстрее", wet: 1 },
	storm: { n: "Гроза", d: "Молнии бьют по случайным бойцам обеих сторон", bolt: 1 },
	heat: { n: "Зной", d: "Миражи. Лечение у всех слабее на 20%", heal: 0.8 },
	sandstorm: { n: "Песчаная буря", d: "Все двигаются на 15% медленнее", spd: 0.85 },
	snow: { n: "Снегопад", d: "" },
	blizzard: { n: "Метель", d: "Все атакуют на 12% реже", as: 0.88 },
	ash: { n: "Пепел", d: "" },
	eruption: { n: "Извержение", d: "Вулканические бомбы падают на поле — уходите из кругов", bomb: 1 },
	spores: { n: "Споры", d: "Яд у всех действует на 2 с дольше", psn: 2 },
	wind: { n: "Попутный ветер", d: "Все двигаются на 15% быстрее", spd: 1.15 },
	wisps: { n: "Блуждающие души", d: "Павшие лечат убийцу на 5%", soul: 1 },
	sparkle: { n: "Мерцание", d: "" },
	resonance: { n: "Резонанс", d: "Шанс крита у всех +10%", crit: 0.1 },
	flux: { n: "Поток хаоса", d: "Каждые 8 с все на время ускоряются или бьют сильнее", flux: 1 },
	glitch: { n: "Сбой реальности", d: "" },
	motes: { n: "Древний свет", d: "" },
	eclipse: { n: "Затмение", d: "Ульты у всех заряжаются в 1.5 раза быстрее", chg: 1.5 },
};
// характеристики врагов: мир 1 — оригинальные числа, дальше растут по экспоненте
const WHP = BAL.foe.hpK,
	WAT = BAL.foe.atkK;
function foeDef(w, slot) {
	const W0 = WORLDS[w],
		b = slot === "boss" ? ENEM.boss : slot === "b" ? ENEM.red : slot === "m" ? ENEM.swamp : ENEM.slime;
	const d = {
		...b,
		// у босса своя кривая: в первом мире с ним справляется отряд из трёх бойцов,
		// дальше он растёт быстрее обычных врагов
		hp: Math.round(slot === "boss" ? b.hp * BAL.foe.bossHp * Math.pow(BAL.foe.bossHpK, w) : b.hp * Math.pow(WHP, w)),
		atk: Math.round(b.atk * Math.pow(WAT, w)),
		arm: Math.round(b.arm * (1 + BAL.foe.armK * w)),
		slot,
		el: W0.el,
		set: slot === "boss" ? "king" : slot === "b" ? "red" : "slime",
		img: slot === "m" ? "m" : "a",
		rad: slot === "boss" ? 46 : slot === "b" ? 19 : 16,
	};
	if (slot === "boss") {
		d.n = W0.boss.n;
		d.boss = 1;
	} else d.n = w === 0 ? b.n : W0.foes[slot === "a" ? 0 : slot === "m" ? 1 : 2];
	if (slot === "m") d.sc = 1.08;
	if (slot === "b") d.sc = 1.15;
	return d;
}
const NODE_LB = { tribe: "Племя", swamp: "Логово", arena: "Арена", barr: "Казармы", mine: "Шахта", chest: "Сундук", secret: "Тайник" };
const NODE_TIP = {
	tribe: "Новый боец присоединится к отряду",
	swamp: "Два сильных врага",
	arena: "Три элитных врага. Награда: 10 монет и 2 мяса",
	barr: "Здоровье отряда +10% и полное лечение",
	mine: "+5 монет",
	chest: "Реликвия случайной редкости",
	secret: "Тайник: редкая находка",
	boss: "Босс мира",
	rand: "Неизвестность: бой или находка",
};

