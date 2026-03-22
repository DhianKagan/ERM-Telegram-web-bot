<!-- Назначение файла: инструкция по обходу ложных срабатываний dependency audit и фиксации evidence. -->

# Обход ложных срабатываний audit-ci

## Control card

- **Owner:** maintainer, принимающий решение по исключению.
- **Trigger:** `audit-ci` / dependency audit сообщает high/critical уязвимость, но обновление недоступно или finding признан неприменимым.
- **Evidence of completion:**
  - идентификатор GHSA/CVE;
  - краткое обоснование, почему риск принят временно;
  - diff `audit-ci.json`;
  - ссылка на issue / upstream discussion / advisory;
  - follow-up задача на удаление allowlist после исправления.
- **Automation status:** ручной процесс, вызываемый только при красном dependency audit.

Если `audit-ci` сообщает уязвимость уровня `high`, но обновление недоступно или проблема признана ложным срабатыванием, добавьте её в `audit-ci.json`.

1. Найдите идентификатор CVE или GHSA в отчёте `audit-ci`.
2. Подтвердите, что уязвимость не влияет на проект или исправление невозможно.
3. Внесите идентификатор в массив `allowlist` файла `audit-ci.json`.
4. Добавьте ссылку на обсуждение в описании коммита или PR.
5. Создайте follow-up на удаление записи из `allowlist` после обновления зависимости.

Пример `audit-ci.json`:

```json
{
  "allowlist": ["GHSA-xxxx-xxxx-xxxx"]
}
```
