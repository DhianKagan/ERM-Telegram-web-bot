<!-- Назначение файла: описание использования lazy-загрузки в веб-клиенте. -->

# Lazy-загрузка компонентов

В веб-клиенте React страницы и тяжёлые компоненты подгружаются динамически через `React.lazy` и `import()`. Это снижает размер начального бандла и ускоряет старт приложения.

- `apps/web/src/App.tsx` лениво подключает страницы: `TasksPage`, `Reports`, `LogsPage`, `Profile`, `TaskKanban`, `CodeLogin`, `AttachmentMenu`, `LogisticsPage`, `RolesPage`, `ThemeSettings`, `StoragePage`.
- Компоненты AG Grid, CKEditor и графики подгружаются лениво в `apps/web/src/components/RecentTasks.tsx`, `TaskTable.tsx`, `TasksChart.tsx`, `LogViewer.tsx`, `CKEditorPopup.tsx`.

Lazy-загрузка выполняется только при первом обращении к компоненту; при повторном рендере используется кэшированный модуль.
