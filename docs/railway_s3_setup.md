<!-- Назначение файла: практический runbook по запуску S3-совместимого хранилища для файлов в Railway и подключению к ERM. -->

# Railway: как поднять отдельный S3 для хранения файлов

Документ описывает 2 рабочих варианта:

1. **Минимальный (быстрый):** поднять S3-совместимый сервис `minio` внутри Railway project.
2. **Рекомендуемый для production:** использовать внешний managed S3 (AWS S3 / Cloudflare R2 / Backblaze B2) и подключить его в Railway через переменные окружения.

> Почему так: Railway volumes удобны для локальных файлов, но для split-архитектуры (`erm-api`, `erm-bot`, `erm-worker`) объектное хранилище проще масштабируется и не привязано к одному контейнеру.

---

## 1) Вариант A (low-risk): отдельный MinIO сервис в Railway

### 1.1 Создание сервиса

1. В Railway откройте проект и создайте новый сервис `erm-s3`.
2. Source: `Deploy from Docker Image`.
3. Image: `minio/minio:latest`.
4. Start Command:

```bash
minio server /data --console-address :9001
```

### 1.2 Переменные окружения `erm-s3`

Задайте в `erm-s3`:

- `MINIO_ROOT_USER=<ваш access key>`
- `MINIO_ROOT_PASSWORD=<ваш secret key>`
- `MINIO_BROWSER_REDIRECT_URL=https://<домен-console-сервиса>` (опционально)

### 1.3 Том для MinIO

Добавьте Volume к `erm-s3`:

- Mount Path: `/data`
- Размер: по фактической потребности + запас.

### 1.4 Создание bucket

После старта откройте MinIO Console (`:9001`) и создайте bucket, например `erm-files`.

### 1.5 Подключение к `erm-api`

В сервисе `erm-api` добавьте переменные:

- `S3_ENDPOINT=http://erm-s3.railway.internal:9000`
- `S3_REGION=us-east-1`
- `S3_BUCKET=erm-files`
- `S3_ACCESS_KEY_ID=<MINIO_ROOT_USER>`
- `S3_SECRET_ACCESS_KEY=<MINIO_ROOT_PASSWORD>`
- `S3_FORCE_PATH_STYLE=true`

> Для приватной сети Railway используйте internal hostname `*.railway.internal`.
>
> Если подключаетесь через публичный домен (`https://...up.railway.app`) вместо internal hostname, оставляйте `https` endpoint и используйте те же ключи MinIO.

### 1.6 FAQ: какой `S3_REGION` ставить, если Railway в EU West?

- Для **MinIO/S3-совместимого** сервиса регион Railway (например, EU West) не определяет значение `S3_REGION`.
- Практически безопасный дефолт для MinIO: `S3_REGION=us-east-1`.
- Критично, чтобы значение региона в клиенте совпадало с ожиданиями S3-сервера. Для MinIO обычно используется `us-east-1`, даже если инфраструктура физически в Европе.
- Для **AWS S3 managed** указывайте реальный регион bucket (например, `eu-west-1`), а не регион Railway.

### 1.7 Как проверить текущий single-container режим перед отказом от `-erm-volume`

Важно: в текущей версии `apps/api` файловый сервис пишет в локальный `STORAGE_DIR` (через `fs`), а переменные `S3_*` из runbook пока не используются кодом напрямую.

Быстрая проверка текущего состояния:

1. Убедитесь по коду, что используется локальный диск:
   - `apps/api/src/config/storage.ts` читает `STORAGE_DIR`.
   - `apps/api/src/services/dataStorage.ts` выполняет запись/чтение через `fs` в `uploadsDir`.
2. В Railway временно установите `STORAGE_DIR=/tmp/erm-storage-check` для `erm-api` и перезапустите сервис.
3. Загрузите тестовый файл через UI/API и убедитесь, что операции upload/download проходят.
4. Проверьте в логах/диагностике, что путь файла формируется из `STORAGE_DIR`, а не из `S3_ENDPOINT`.

Вывод: пока не внедрён S3-adapter в API, проверить «реальную запись в S3 вместо volume» на уровне приложения нельзя — можно проверить только готовность инфраструктуры (доступность MinIO endpoint и ключей).

---

## 2) Вариант B (recommended): managed S3 вне Railway

### 2.1 Что выбрать

- **AWS S3** — стандартный вариант, высокая совместимость.
- **Cloudflare R2** — нет платы за egress из R2, часто дешевле для отдачи файлов.
- **Backblaze B2 (S3 API)** — бюджетный вариант с S3-совместимым API.

### 2.2 Что сделать

1. Создайте bucket у провайдера.
2. Создайте ключи доступа с минимальными правами (только нужный bucket).
3. В `erm-api` добавьте:
   - `S3_ENDPOINT` (для AWS можно не задавать, для R2/B2 нужен)
   - `S3_REGION`
   - `S3_BUCKET`
   - `S3_ACCESS_KEY_ID`
   - `S3_SECRET_ACCESS_KEY`
   - `S3_FORCE_PATH_STYLE` (`true` для некоторых S3-совместимых провайдеров)
4. Проверьте upload/download на тестовом файле.

---

## 3) Что оставить в текущем split-деплое

Для схемы `erm-api / erm-bot / erm-worker`:

- Redis volume — **только** у Redis.
- Mongo volume — **только** у MongoDB.
- S3-хранилище файлов — через отдельный `erm-s3` сервис (MinIO) **или** внешний managed S3.
- `STORAGE_DIR` оставляйте только как fallback/временный локальный путь, пока идёт миграция.

---

## 4) Мини-чеклист после запуска

1. Upload файла через API проходит без ошибок.
2. Скачивание/превью файла работает по ссылке.
3. После рестарта `erm-api` файл доступен.
4. У бота и воркера нет зависимости от локального `/storage`.
5. В логах нет ошибок авторизации S3 (`AccessDenied`, `InvalidAccessKeyId`, `SignatureDoesNotMatch`).

### 4.1 Cutover-чеклист перед отказом от `-erm-volume`

1. В `erm-api` заполнены S3-переменные (`S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`).
2. `S3_ENDPOINT` использует правильную схему (`https://` для публичного Railway endpoint, `http://` для private `*.railway.internal`).
3. Доступен хотя бы один тестовый upload/download без использования локального пути `/storage`.
4. `STORAGE_DIR` оставлен только как временный fallback и не является обязательной зависимостью для рантайма.
5. Только после успешной проверки можно отключать volume для приложения (`erm-api`), оставляя volume только у самого S3-сервиса (MinIO), если он self-hosted.

---

## 5) Риски и как снизить

- **Риск:** хранение секретов S3 в репозитории.
  - **Решение:** ключи только в Railway Variables.
- **Риск:** открытый публичный bucket.
  - **Решение:** приватный bucket + выдача URL через API.
- **Риск:** медленная миграция со старого `STORAGE_DIR`.
  - **Решение:** поэтапный dual-write/dual-read (сначала чтение из обоих источников, потом отключение локального).

---

## 6) Быстрый выбор

- Нужно "поднять сегодня" внутри Railway: берите **MinIO (Вариант A)**.
- Нужен production без операционного долга: берите **managed S3 (Вариант B)**.

---

## 7) Runbook миграции storage-records (audit → dry-run → apply → smoke-check API)

Ниже порядок, который безопасно запускать на Railway shell/console для `erm-api`.

### 7.1 Audit (только чтение)

```bash
pnpm exec tsx scripts/db/audit_storage_records.ts
```

Ожидаемый результат: JSON-отчёт с категориями `valid_s3`, `legacy_local`, `broken_ref`, `missing_file_doc` и `sample_id`.

### 7.2 Migrate в DRY_RUN

```bash
DRY_RUN=true APPLY=false \
BATCH_SIZE=200 MAX_UPDATES=1000 \
CHECKPOINT_FILE=scripts/db/.migrate_storage_records.checkpoint.json \
pnpm exec tsx scripts/db/migrate_storage_records.ts
```

Ожидаемый результат: без изменений в БД, только отчёт `stats` + `sample_id` + путь к checkpoint.

### 7.3 Migrate в APPLY

```bash
DRY_RUN=false APPLY=true \
BATCH_SIZE=200 MAX_UPDATES=1000 \
CHECKPOINT_FILE=scripts/db/.migrate_storage_records.checkpoint.json \
pnpm exec tsx scripts/db/migrate_storage_records.ts
```

Что делает APPLY:

- удаляет/чистит legacy/broken/missing ссылки в `tasks.attachments` и `tasks.files`;
- нормализует ссылки к каноничному виду `/api/v1/files/<id>`;
- нормализует `files.path` из legacy local пути (`/uploads/...`) в storage-key формат;
- пишет checkpoint и позволяет продолжить миграцию с последнего `_id`.

Для ручного resume:

```bash
DRY_RUN=false APPLY=true START_AFTER_ID=<last_id_from_checkpoint> \
pnpm exec tsx scripts/db/migrate_storage_records.ts
```

### 7.4 Smoke-check API после APPLY

Минимальные проверки:

1. `GET /api/v1/storage/files` возвращает список без 500.
2. `GET /api/v1/files/:id` по нескольким `sample_id` отдаёт файл/корректную ошибку 404.
3. Открытие задач с вложениями в UI не ломается, ссылки ведут на `/api/v1/files/<id>`.
