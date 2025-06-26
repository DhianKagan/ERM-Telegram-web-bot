<!-- Назначение файла: руководство по настройке функций Telegram-бота. -->
# Мануал по настройке Telegram-бота

В этом документе описаны базовые шаги для конфигурации и использования функций бота согласно [Telegram Bot API](https://core.telegram.org/bots/api). Предполагается, что бот развёрнут из каталога `bot`.

## Получение токена
1. Откройте диалог с [@BotFather](https://t.me/BotFather).
2. Введите команду `/newbot` и следуйте подсказкам для задания имени и юзернейма.
3. После создания BotFather выдаст токен доступа вида `123456:ABC-DEF` — скопируйте его.
4. Запишите токен в переменную `BOT_TOKEN` файла `.env`.


### Настройка описания и ссылки
Вы также можете настроить описание и аватар:
```bash
curl "https://api.telegram.org/bot${BOT_TOKEN}/setMyDescription" -d 'description=Task manager bot'
curl "https://api.telegram.org/bot${BOT_TOKEN}/setChatPhoto" -F "photo=@avatar.png"
```

## Установка команд бота
Telegram позволяет задать список команд для подсказок пользователю:
```bash
curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands" \
  -H "Content-Type: application/json" \
  -d '{"commands":[{"command":"start","description":"Запуск"},
                    {"command":"help","description":"Справка"}]}'
```
Команды будут отображаться в меню клиента Telegram.

Для упрощения в репозитории есть файл `scripts/bot_commands.json` с набором типовых команд и скрипт `scripts/set_bot_commands.sh`:
```bash
BOT_TOKEN=123 scripts/set_bot_commands.sh
```
Скрипт отправит содержимое JSON в метод `setMyCommands` и обновит меню бота.

### Быстрая настройка через BotFather
Если нет доступа к терминалу, воспользуйтесь диалогом с BotFather:
1. Отправьте команду `/setcommands` и выберите нужного бота.
2. Отправьте список строк вида `команда - описание`. Пример:
   ```
   start - Запуск бота
   help - Справка
   ```
3. Можно прикрепить файл со списком команд или ссылку на него — BotFather примет её и обновит меню.
4. Текущий перечень меню можно получить через `/mybots` → **Bot Settings** → **Edit Commands** и опцию `Copy commands link`.
   Аналогичный запрос через API:
   ```bash
   curl "https://api.telegram.org/bot${BOT_TOKEN}/getMyCommands"
   ```

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
Ниже приведены основные команды:
- `/create_task` — создать задачу
- `/assign_task` — назначить задачу пользователю
- `/list_tasks` — мои задачи
- `/list_all_tasks` — все задачи (только для админа)
- `/update_task_status` — сменить статус задачи
- `/upload_file` — отправить текстовый файл в R2
- `/send_photo` — отправить фото по URL
- `/edit_last` — редактировать сообщение
- При первом `/start` бот отправляет ссылку на мини‑приложение, поэтому
  команда `/app` остаётся дополнительным способом открыть его

## Диагностика
Запрос `getMe` проверяет работоспособность токена:
```bash
curl "https://api.telegram.org/bot${BOT_TOKEN}/getMe"
```

## Проверка URL кнопки меню
Скрипт `scripts/get_menu_button_url.js` выводит текущую ссылку в меню Telegram. Если меню сброшено к стандартным командам, вернётся `/empty`.
```bash
node scripts/get_menu_button_url.js
```
Пример вывода при дефолтных переменных окружения:
```
Ошибка: request to https://api.telegram.org/botyour_bot_token/getChatMenuButton failed, reason:
```

Теперь вы можете адаптировать приведённые примеры под особенности проекта и расширять функциональность бота.
