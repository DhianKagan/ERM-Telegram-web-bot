# План стабилизации модуля «Логистика»

Документ фиксирует приоритеты, ожидаемый состав работ и проверки для восстановления обмена логистическими данными без зависимости от карт.

## Приоритетная дорожная карта

### Эпик 1. Поток событий

- Подробный лог открытия SSE и задержек heartbeat, фиксация readyState при ошибках.
- Автоматический переход на поллинг при таймаутах или закрытии соединения, configurable-интервалы.
- Повторное подключение с экспоненциальной паузой и метриками ошибок.

### Эпик 2. Согласованность маршрутов

- Немедленное обновление списка задач и активного плана после событий `route-plan.updated`.
- Защита от устаревших черновиков: валидация версии плана и очистка локального кэша по маске пользователя.
- Контроль статуса пересчёта оптимизатора в интерфейсе, в том числе при повторном входе.

### Эпик 3. Инфраструктура SSE и кэшей

- Проверка заголовков `Content-Type`, `Cache-Control` и `Connection` для `/api/v1/logistics/events`.
- Наблюдаемость ошибок HTTP/2 и таймаутов соединения, алерты на количество повторных подключений.
- Ограничение TTL локальных кэшей маршрутов, явное сброс кэша после ручной чистки данных.

## Быстрые правки

1. Переключение на поллинг при сбое SSE:

   ```ts
   const source = new EventSource('/api/v1/logistics/events');
   const fallback = () => startPolling({ intervalMs: pollInterval });
   const openTimeout = setTimeout(() => fallback(), 8000);

   source.addEventListener('open', () => clearTimeout(openTimeout));
   source.addEventListener('error', (event) => {
     logger.warn('SSE сбой', {
       readyState: source.readyState,
       type: event.type,
     });
     source.close();
     fallback();
   });
   ```

2. Защита версии маршрутного плана:

   ```ts
   if (serverVersion !== localVersion) {
     clearLocalDraft();
     refetchPlan();
   }
   ```

3. Метрика недоступности потока:

   ```ts
   metrics.logisticsSseUnavailable.inc();
   ```

## PR-план

- **Ветка**: `feature/logistics-stream-stability`
- **Название PR**: «Logistics: стабилизация событий и маршрутов»
- **Основные файлы**: `apps/web/src/services/logisticsEvents.ts`, `apps/web/src/pages/Logistics.tsx`, `apps/web/src/pages/LogisticsPlan.tsx`, `apps/web/src/hooks/useLogistics.ts`, `docs/logistics_recovery_plan.md`.

## Тест-план

- **Unit/интеграция**: `pnpm -F web test`, `pnpm lint`, `pnpm typecheck`.
- **Ручные проверки**:
  1. SSE соединение остаётся открытым не менее 15 секунд, heartbeats приходят регулярно.
  2. При `VITE_DISABLE_SSE=1` включается поллинг с интервалом `VITE_LOGISTICS_POLL_INTERVAL_MS`.
  3. Изменение плана через API мгновенно отражается на открытой странице без перезагрузки.
  4. Разрыв SSE триггерит один fallback без роста числа одновременных подключений.

## DEV/DEVOPS чек-лист

- `curl -v --http2 https://<host>/api/v1/logistics/events -H 'Accept: text/event-stream'` — код 200, корректные заголовки.
- `curl -v -N --http2 https://<host>/api/v1/logistics/events -H 'Accept: text/event-stream' --max-time 15` — поток не закрывается до таймаута.
- Логи Nginx/Ingress без `upstream prematurely closed connection` и `RST_STREAM`.
- Метрики отказов поллинга/SSE отображаются в мониторинге и имеют алерты.

## UX/адаптивность

- Список задач и панель маршрутов остаются читаемыми на мобильных: минимальная высота интерактивных элементов 44 px, скроллинг в дополнительных панелях.
- Изменения статуса плана отображаются тостами и индикатором синхронизации.

## Риски и откат

- Риск: агрессивный поллинг перегружает API — смягчается бэкофом и лимитом одновременных запросов.
- Риск: длительные SSE-запросы блокируются прокси — проверять keep-alive и таймауты на балансировщике.
- Откат: `git revert <PR>` и перезапуск фронта/бота.
