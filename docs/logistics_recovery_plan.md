# План стабилизации модуля «Логистика»

Документ фиксирует приоритеты, конкретные изменения и проверки для восстановления карты (PMTiles/Protomaps) и SSE.

## Приоритетная дорожная карта

### Эпик 1. Доступность карты и слоёв (блокер)

- **Story 1.1**: Гарантировать регистрацию `pmtiles` до инициализации карты; логировать успех/отказ.
- **Story 1.2**: Динамически определять первичный vector source и использовать его в 3D-слое и адресах.
- **Story 1.3**: Улучшить fallback стилей с явным логом причины и URL.

### Эпик 2. Стабильность источников данных

- **Story 2.1**: Безопасное добавление адресного слоя только при наличии URL и доступном `pmtiles`.
- **Story 2.2**: Улучшить обработку ошибок SSE и fallback-поллинга: детальный лог `readyState/status`, таймаут открытия SSE и гарантированный переход на fallback.

### Эпик 3. Инфраструктура и отдача статики

- **Story 3.1**: Проверка MIME для CSS (`text/css`) на фронтовом CDN/прокси.
- **Story 3.2**: Проверка заголовков SSE (`Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`) и HTTP/2 keep-alive без преждевременного закрытия.

## Готовые патчи (фрагменты)

1. **Ожидание регистрации PMTiles перед созданием карты**

   ```ts
   const pmtilesReady = await registerPmtilesProtocol();
   if (MAP_STYLE_MODE === 'pmtiles' && !pmtilesReady) {
     console.warn('PMTiles протокол не зарегистрирован, возможны проблемы...');
   }
   const mapInstance = new mapLibrary.Map({ ... });
   ```

2. **Детектор основного векторного источника и использование в 3D-слое**

   ```ts
   import { detectPrimaryVectorSourceId } from './vectorSource';

   const vectorSourceId = detectPrimaryVectorSourceId(map);
   if (!vectorSourceId) return null;
   map.addLayer({ id: BUILDINGS_LAYER_ID, source: vectorSourceId, ... });
   ```

3. **Усиленный attachMapStyleFallback с детализацией причины**
   ```ts
   logger.warn('Не удалось загрузить кастомный стиль...', {
     details,
     initialStyle,
     fallbackUrl,
   });
   logger.warn('Ошибка загрузки стиля карты', { url, status, message });
   map.setStyle(fallbackUrl, { diff: false });
   ```

## PR-план

- **Ветка**: `feature/logistics-map-stability`
- **Название PR**: «Logistics: стабилизация PMTiles, fallback и адресных слоёв»
- **Основные файлы**: `apps/web/src/pages/Logistics.tsx`, `apps/web/src/utils/insert3dBuildingsLayer.ts`, `apps/web/src/mapLibrary.ts`, `apps/web/src/services/logisticsEvents.ts`, `apps/web/src/utils/vectorSource.ts`, `docs/logistics_recovery_plan.md`.
- **Ревью-чеклист**:
  - PMTiles регистрируется до `new Map` и логирует успех/ошибку.
  - 3D и адресные слои появляются при наличии vector источника; отсутствуют бесшумные пропуски.
  - Fallback стиля пишет URL/статус в консоль и не затирает рабочий векторный стиль без причины.
  - SSE ошибки ведут к fallback-поллингу с явным предупреждением.

## Тест-план

- **Unit/интеграция (локально)**:
  - `pnpm -F web test` — базовые тесты фронтенда.
  - `pnpm lint` и `pnpm typecheck` — статический анализ.

- **Ручные проверки**:
  1. Запустить фронт: `pnpm -F web run dev`.
  2. Убедиться, что карта грузится без переключения на raster fallback (консоль без warn о стиле).
  3. При наличии `VITE_MAP_ADDRESSES_PMTILES_URL` увидеть домовые номера на zoom ≥ 17; при пустой переменной — получить warn «Адресные плитки не подключены».
  4. Проверить 3D-здания на zoom 15+ и что слой не пропадает при смене стиля.
  5. Проверить SSE: в консоли нет `ERR_HTTP2_PROTOCOL_ERROR`; при отключении SSE (`VITE_DISABLE_SSE=1`) включается поллинг с интервалом `VITE_LOGISTICS_POLL_INTERVAL_MS`.

## DEV/DEVOPS чек-лист

- **CSS MIME**: `curl -I https://<host>/js/index-*.css` — ожидаем `Content-Type: text/css`. В nginx: `types { text/css css; }` и `add_header Content-Type text/css;` для fallback.
- **SSE/HTTP2**:
  - `curl -v --http2 https://<host>/api/v1/logistics/events -H 'Accept: text/event-stream'` — ожидаем `HTTP/2 200`, заголовки `content-type: text/event-stream`, `cache-control: no-cache`, `connection: keep-alive`.
  - `curl -v -N --http2 https://<host>/api/v1/logistics/events -H 'Accept: text/event-stream' --max-time 15` — поток должен оставаться открытым (нет `Empty reply from server`), приходит хотя бы один heartbeat за 15 секунд.
  - `curl -v --http2 https://<host>/api/v1/logistics/events -H 'Accept: text/event-stream' --write-out '\ncode:%{response_code} time:%{time_total}\n' --max-time 10` — фиксируем код 200 и отсутствие раннего обрыва соединения.

## Клиентский fallback SSE

- Таймаут открытия SSE: если соединение не переходит в `open` за 8 секунд, клиент пишет предупреждение с `readyState`/`status` и включает fallback-поллинг.
- Лог при ошибке SSE теперь дополнительно фиксирует `readyState` и, если доступен, `status` из EventSource/события.
- **CORS/тайлы**: `curl -I https://<host>/<path>.pmtiles` и JSON стиля — проверка `Access-Control-Allow-Origin` и кода 200.

## UX/адаптивность (технический план)

- Карта остаётся главным элементом (занимает высоту экрана минус хедер). Панель задач — плавающая/сворачиваемая с управлением из кнопки на карте.
- Мобильный режим: переключатель «Карта / Список», `flex-col` и скрытие вторичных панелей; крупные touch-таргеты (минимум 44px).
- Риск: переполнение панелей на малых экранах — проверять clamp по высоте и `overflow-auto`.

## Риски и откат

- **Риск**: регистрация pmtiles может провалиться в сборках без `addProtocol`; mitigated логированием и сохранением raster fallback.
- **Риск**: некорректный MIME на CDN блокирует CSS — проверяется curl; откат — вернуть предыдущую конфигурацию nginx/CDN.
- **Откат**: `git revert <PR>` + перезапуск фронта; для nginx — откатить конфиг и перезагрузить сервис.
