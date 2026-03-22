<!-- Назначение файла: сопровождение Content Security Policy и обязательного evidence для изменений allowlist. -->

# Content Security Policy

## Control card

- **Owner:** Web owner совместно с API owner.
- **Trigger:** любой PR, добавляющий внешние домены, CDN, analytics, embed, inline-script/style исключения или меняющий CSP env allowlist.
- **Evidence of completion:**
  - diff allowlist/env или middleware CSP;
  - подтверждение актуального заголовка `Content-Security-Policy` или `Content-Security-Policy-Report-Only`;
  - ссылка на violation-report / browser-console проверку без неожиданных нарушений;
  - если режим переводится из report-only в enforcing — ссылка на период наблюдения и решение владельца.
- **Automation status:** документировано; отдельной CI-проверки CSP в репозитории сейчас нет.

CSP защищает приложение от поддельных ресурсов. По умолчанию включён режим
`report-only`, чтобы собрать отчёты о нарушениях и не ломать Mini App.
В строгом режиме добавляется директива `upgrade-insecure-requests`,
переводящая все HTTP-запросы на HTTPS. Для получения отчётов задайте
переменную `CSP_REPORT_URI` с адресом приёма сообщений.

## Нонсы для скриптов и стилей

Каждый ответ сервера содержит случайный `nonce`, который добавляется в
директивы `script-src` и `style-src` вместе с `'unsafe-inline'`. CKEditor
использует этот `nonce` в своих встроенных тегах, что позволяет обойтись
без ослабления политики.

## PR / release checklist

1. Добавить домен только в минимально необходимую allowlist-переменную.
2. Подтвердить, что после изменения нет новых необъяснённых CSP violations.
3. Для release зафиксировать, остаётся ли режим `report-only` или включается enforcement.
4. Если включается enforcement, приложить evidence наблюдения минимум за 48 часов до переключения.

## Расширение белого списка

1. Добавьте домен в нужную переменную окружения `.env`:
   - `CSP_CONNECT_SRC_ALLOWLIST`
   - `CSP_IMG_SRC_ALLOWLIST`
   - `CSP_SCRIPT_SRC_ALLOWLIST`
   - `CSP_STYLE_SRC_ALLOWLIST`
     Значения разделяйте пробелом или запятой.
2. Перезапустите сервер.
3. После 48 часов и анализа отчётов установите `CSP_REPORT_ONLY=false`
   для включения строгого режима.
