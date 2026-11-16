# NEXT — что осталось и как продолжить

**Точка остановки:** 2026-11-16, ветка `arena/4df08b0f-repo` → `main` в процессе слияния, сборка `7219aa3d677cca6a` зелёная.

## Сделано полностью (A–D, G-частично)

- A. Аудит: extract/build детерминированы, 16 тестов, golden 200/500, perf/fuzz/soak зелёные.
- B. Rand + golden: 60 Math.random → Rand, эталон `297e1dc9`/`8a1490b0`.
- C. Ядро: журнал 200, errFrameOk, аварийное окно DOM, GAME_BUILD.
- D. Сохранения v3: FNV-1a, .bak, миграции 2→3, fuzz 1000.
- G (частично): bakeMap кэш 910→0 мс, budgets в отчёте.
- Backup: `backup/original.html` сохранён (a4253479...), `dist/game.html` 5.7МБ выдан.

## Очередь (по промту A–T + 3× красной команды)

| Приоритет | Этап | Следующая команда | Критерий готовности |
|---|---|---|---|
| 1 | E. Данные | `npm run golden` после выноса таблиц в `src/game/20_data.js` без смены чисел | golden 200/500 бит-в-бит, `BALANCE.md` |
| 2 | F. Бой | разбить `unitStep` (246) → `unitStepMove/Attack/Stun` ≤60стр, `dFight`/`dShop` аналогично, пулы | `wc -l` функции ≤60, soak рост кучи ≤5% |
| 3 | H/K. State | `src/game/06_state.js` — все `S===` уходят туда, таблица переходов, `npm test` State | `grep -rn 'S ==='` вне 06 =0 |
| 4 | M. Подвисание | профилировать `bakeMap` + тонировку → `requestIdleCallback` порциями, индикатор | первый вход ≤100мс |
| 5 | N. Кэши LRU | `TINTC/GLOWC` лимит 64, LRU, тест | soak 60мин ≤5% |
| 6 | O. E2E | `npm run e2e` Playwright: menu→pick→map→fight×3 скорости→shop→save→reload→pickup | скриншоты ≤0.5% |
| 7 | P. Редактор | песочница iframe, откат good, точечные патчи, хэш пароля | 5 ломаных патчей откатились |
| 8 | Q–R. Чистка+perf | без аллокаций в hot loop, DPR≤2, shadowBlur только на Q=high | update≤3мс/draw≤8мс |
| 9 | S. Безопасность | `num()` везде, валидация импорта, 100 тапов/сек | fuzz 5000 →0 исключений |
| 10 | T. Доки | ARCHITECTURE с диаграммой, SAVE_FORMAT, REPORT, README «добавить юнита за 10мин» | пример теста зелёный |
| 11 | Красная команда ×3 | 10 атак/раунд, 5 фиксов/раунд, тест падал→прошёл, 10 багов →8 ловятся | записи в WORKLOG |

## Команды для продолжения

```bash
git checkout arena/4df08b0f-repo
npm run check && npm test && npm run golden && npm run fuzz
# затем по этапу:
node tools/build.mjs --dist && npm run perf && npm run soak
# E2E:
npx playwright install chromium && npm run e2e
```

## Состояние веток

- `main` @ `3c04b61` (до этой сессии), PR #3 открыт → надо слить: `gh pr merge 3 --merge`
- `arena/4df08b0f-repo` @ e6b734f с FULL_REVIEW, ждёт FULL_REVIEW→State→Editor коммитов
- `dist/game.html` промежуточный после каждого этапа — отдавать как `present_file dist/game.html`

Скажи «продолжай» — возобновлю с H/K (State-машина, самый большой долг).
