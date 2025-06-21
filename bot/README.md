<!-- Назначение файла: описание Telegram-бота и инструкции по запуску. -->
# Бот управления задачами

Данный модуль представляет Telegram-бота с мини‑приложением для учёта задач. Все сервисы собираются через Docker.

## Структура
- `src/bot` — логика бота
- `src/services` — операции с задачами
- `src/db` — модели MongoDB
- `src/api` — REST API
- `src/auth` — аутентификация
- `client` — исходники мини‑приложения React

## Требования
- Node.js
- npm
- Docker

## Установка
```bash
git clone https://github.com/AgroxOD/agrmcs.git
cd agrmcs/bot
npm install # устанавливает зависимости и собирает мини‑приложение
```
Создайте `.env` на основе файла `../.env.example` и задайте `CHAT_ID` через бот @userinfobot.
При изменении исходников фронтенда запустите `npm run build-client`.

## Запуск
```bash
npm start
```

## Docker
```bash
docker build -t task-bot .
docker run --env-file ../.env -p 3000:3000 task-bot
```

## Развёртывание
Для Railway укажите рабочую директорию `bot` и переменные из `.env`.
