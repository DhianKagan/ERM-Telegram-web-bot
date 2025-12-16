"use strict";
// Назначение: экранирование текста для MarkdownV2
// Основные модули: отсутствуют
Object.defineProperty(exports, "__esModule", { value: true });
exports.escapeMarkdownV2 = escapeMarkdownV2;
const MARKDOWN_V2_ESCAPE_REGEXP = /[[\\\]_*()~`>#+\-=|{}.!]/g;
function escapeMarkdownV2(value) {
    return String(value).replace(MARKDOWN_V2_ESCAPE_REGEXP, '\\$&');
}
exports.default = escapeMarkdownV2;
