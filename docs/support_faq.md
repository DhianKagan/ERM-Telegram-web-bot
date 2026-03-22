<!-- Назначение файла: ответы на часто задаваемые вопросы для саппорта. -->

# FAQ для саппорта

## Как получить роль менеджера?

Попросите администратора назначить роль `manager` в разделе «Настройки → Роли»
или отправьте запрос в службу поддержки.

## Почему e2e тесты падают с ошибкой об отсутствующем Chromium?

Воспользуйтесь скриптом `./scripts/ensure_playwright_browsers.sh`,
он установит Firefox и Chromium с зависимостями.
Затем запустите `./scripts/run_playwright_diagnostics.sh` — он попробует `playwright doctor`
и при необходимости выполнит `playwright install --list`.
Если ошибка повторяется в CI, убедитесь, что шаг «Диагностика Playwright»
в workflow CI появился в сводке и откройте загруженные артефакты браузеров.

## Где искать troubleshooting для `/api/v1/maps/expand`?

Единый источник troubleshooting по раскрытию Google Maps ссылок, включая кейсы с логами
`Headless fallback disabled: module "playwright" is not installed in this runtime`
и `Headless fallback disabled: browser executable is missing for module "playwright"`,
теперь находится в `docs/technical_manual.md`, раздел
[`/api/v1/maps/expand`: раскрытие Google Maps ссылок](./technical_manual.md#apiv1mapsexpand-раскрытие-google-maps-ссылок).
Используйте именно этот раздел, чтобы не поддерживать две расходящиеся инструкции.

## Есть ли онлайн-трекинг транспорта?

Сейчас данные по технике обновляются только после ручных действий оператора.
Автоматическое отслеживание перемещений в реальном времени недоступно.
