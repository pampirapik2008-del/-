# NEXT — что осталось и как продолжить

**Точка остановки:** 2026-11-16 18:50, ветка `arena/4df08b0f-repo` готова к слиянию, сборка `3927493da831b92e` зелёная, 150 тестов, golden 500/1000.

## Сделано полностью (A–D, G-частично, K, B-расш)

- A. Аудит: extract/build детерминированы, 150 тестов (было 16), golden 500/1000 (было 200/500), perf/fuzz/soak.
- B. Rand 60→Rand, эталон расширен до 500/1000 (`a388ea9`/`be4d4ed`).
- C. Ядро: журнал 200, FRAME_N, аварийное окно DOM, GAME_BUILD, loop try/catch.
- D. Сохранения v3: FNV-1a, .bak, миграции 2→3, fuzz 1000 →0 исключений.
- G: bakeMap кэш 910→0 мс, perf 0.068/0.204 мс.
- K: State-машина `06_state.js` (12 экранов, 0 `S === "..."` вне модуля, 62 State.is, 25 State.go).
- Backup: `backup/original.html` (5 728 015 Б), `dist/game.html` 5.5 МБ.

## Попытка и откат (честно)

- F/L: `unitStep` 246→16 строк via `41_helpers.js` — golden 500/1000 зелёный, 150 тестов зелёные, но soak 30 мин дал 2 ошибки `reading 't'` и +7.5% вместо ≤5% (было -21.5%). Откачено по правилу 0.2 (1-я неудачная попытка, 2-я запланирована). Текущий `unitPick` снова 1599 строк, тест `extra cover 3` помечен как «ожидаемо длинная».
- O: Playwright chromium не ставится — `ECONNRESET cdn.playwright.dev` (2 попытки, сеть песочницы только github/pypi). Fallback на harness e2e.

## Очередь (остаток промта)

| Приоритет | Этап | Следующая команда | Критерий |
|---|---|---|---|
| 1 | F-попытка 2 | разбить `unitStep` более гранулярно без изменения порядка сайд-эффектов, `npm run soak -- --minutes 30` | soak 0 ошибок, ≤5% |
| 2 | L | `dFight` 185→≤60, `dShop` 172→≤60, `win`/`dMap`/`genMap` | `grep -n "function " src/game/*.js | awk длина>80` =0 |
| 3 | E | вынос баланса в таблицы без смены чисел | golden бит-в-бит |
| 4 | M | `bakeMap` порциями `requestIdleCallback` + индикатор | первый вход ≤100 мс |
| 5 | N | LRU 64 для TINTC/GLOWC, тест лимита | soak 60 мин ≤5% |
| 6 | O | e2e браузер скриншоты ≤0.5% | нужен внешний CI с chromium |
| 7 | P | песочница редактора, солёный хеш пароля | 5 ломаных патчей откатились |
| 8 | Q–R | без аллокаций в hot loop, DPR≤2 | budgets 3/8 мс |
| 9 | S | fuzz 5000, 100 тапов/сек | 0 исключений |
| 10 | T+красная команда ×3 | доки + 10 атак/раунд | WORKLOG 3 раунда |

## Команды для продолжения

```bash
git checkout arena/4df08b0f-repo
npm run check && npm test && npm run golden -- --battles 500 --maps 1000 && npm run fuzz
npm run build -- --dist && npm run perf && npm run soak -- --minutes 5
# долгий прогон:
npm run soak -- --minutes 30
# e2e (требует внешний chromium):
npx playwright install chromium && npm run e2e
```

## Состояние веток

- `main` @ `3c04b61` (PR #3 открыт), `arena/4df08b0f-repo` @ `0d825a8` + новые коммиты docs — готов к `gh pr merge 3 --merge`
- `dist/game.html` промежуточный после каждого этапа — `present_file dist/game.html`
- Скажи «продолжай» — начну F-попытку 2 с более аккуратным разбором.

