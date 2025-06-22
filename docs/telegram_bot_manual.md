<!-- Назначение файла: руководство по настройке функций Telegram-бота. -->
# Мануал по настройке Telegram-бота

В этом документе описаны базовые шаги для конфигурации и использования функций бота согласно [Telegram Bot API](https://core.telegram.org/bots/api). Предполагается, что бот развёрнут из каталога `bot`.

## Получение токена
1. Запустите диалог с [@BotFather](https://t.me/BotFather).
2. Создайте нового бота командой `/newbot` и сохраните выданный токен доступа.
3. Запишите токен в переменную `BOT_TOKEN` файла `.env`.

## Установка команд бота
Telegram позволяет задать список команд для подсказок пользователю:
```bash
curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands" \
  -H "Content-Type: application/json" \
  -d '{"commands":[{"command":"start","description":"Запуск"},
                    {"command":"help","description":"Справка"}]}'
```
Команды будут отображаться в меню клиента Telegram.

## Работа с вебхуками
Наш проект по умолчанию использует метод `getUpdates`, но поддерживает вебхуки для большей надёжности:
1. Укажите публичный URL в переменной `WEBHOOK_URL`.
2. Выполните настройку вебхука:
```bash
curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -d "url=${WEBHOOK_URL}"
```
3. Для проверки используйте `getWebhookInfo`.

## Отправка сообщений
Примеры запросов к Telegram Bot API:
```bash
curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
  -d chat_id=${CHAT_ID} \
  -d text="Привет!"
```
В коде проекта отправка реализована в `src/bot/bot.js` с помощью библиотеки `node-telegram-bot-api`.

## Использование клавиатур
Для интерактивного взаимодействия можно подключить встроенные клавиатуры:
```javascript
bot.sendMessage(chatId, 'Выберите действие', {
  reply_markup: {
    keyboard: [[{ text: 'Создать задачу' }], ['Список задач']],
    resize_keyboard: true
  }
});
```
Подробнее об опциях клавиатур смотрите в разделе [ReplyKeyboardMarkup](https://core.telegram.org/bots/api#replykeyboardmarkup).

## Дополнительные функции
- [Inline-режим](https://core.telegram.org/bots/api#inline-mode) позволяет обрабатывать запросы без открытия диалога с ботом.
- `sendPhoto` отправляет изображения, пример команды `/send_photo <url>`.
- `editMessageText` позволяет редактировать сообщения, используйте `/edit_last <id> <текст>`.
- Для произвольных методов можно вызвать `call('method', params)` из `telegramApi.js`.
- Для международной аудитории подключите `language_code` из объекта `from`.

## Регистрация и администрирование
Бот автоматически сохраняет пользователя при `/start`. Администраторы используют `/list_users` и `/add_user` для управления списком пользователей.

## Диагностика
Запрос `getMe` проверяет работоспособность токена:
```bash
curl "https://api.telegram.org/bot${BOT_TOKEN}/getMe"
```

Теперь вы можете адаптировать приведённые примеры под особенности проекта и расширять функциональность бота.
