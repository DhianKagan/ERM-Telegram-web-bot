/**
 * Назначение файла: настройка переменных окружения для юнит-тестов.
 * Основные модули: process.
 */

process.env.BOT_TOKEN ||= 'test-bot-token';
process.env.CHAT_ID ||= '0';
process.env.JWT_SECRET ||= 'test-secret';
process.env.APP_URL ||= 'https://example.com';
