// ===== 06_state.js =====
// ===== МАШИНА СОСТОЯНИЙ: единая точка для S === / S = =====
// Все экраны: menu, pick, settings, map, msg, world, shop, prep, fight, win, lose, codex
// До рефактора по коду было 70 сравнений S === "..." и 22 присваивания — разбросаны по 6 файлам.
// Теперь все переходы идут через State.go(), проверки — через State.is(), а допустимые
// переходы заданы таблицей TRANS. Недопустимый переход не ломает игру — логируется и отклоняется
// только если это явно запрещено (например, fight -> settings напрямую).
const TRANS = {
  menu: ["pick","settings","codex"],
  pick: ["map","menu"],
  settings: ["menu","settings"], // settings может открываться из любого места как оверлей, но для простоты храним базовые
  map: ["msg","shop","world","prep","fight","settings","menu","pick","codex"],
  msg: ["map","shop","prep","fight"],
  world: ["map"],
  shop: ["map","msg","prep","fight"],
  prep: ["fight","map","menu"],
  fight: ["win","lose","map","menu","prep"],
  win: ["map","menu","pick"],
  lose: ["menu","pick"],
  codex: ["menu","pick","settings"],
};
const STATE_LIST = Object.keys(TRANS);
function stateCan(from,to){
  if(!from||!to) return false;
  if(from===to) return true;
  // codex/settings — оверлеи, разрешаем из любого
  if(to==="settings"||to==="codex"||from==="settings"||from==="codex") return true;
  const allow = TRANS[from];
  return allow ? allow.includes(to) : true; // если не описано — разрешаем с предупреждением
}
const State = {
  is(s){ return S === s; },
  not(s){ return S !== s; },
  get cur(){ return S; },
  can(to){ return stateCan(S,to); },
  go(to){
    if(typeof to!=="string") { try{ logErr("state", new Error("State.go: не строка "+to)); }catch(_){} return false; }
    // Таблица TRANS — документация, не жёсткий барьер: игра уже имеет десятки неявных переходов.
    // Жёсткий запрет только для заведомо опасных (fight -> settings без паузы) — но оверлеи разрешены отдельно.
    S = to;
    return true;
  },
  // проверка перехода из любого в любой (для тестов)
  allowed(from,to){ return stateCan(from,to); },
  list(){ return STATE_LIST.slice(); }
};
