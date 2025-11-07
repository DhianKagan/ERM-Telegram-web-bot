"use strict";
// Формирует ссылку tg://user для MarkdownV2
// Основные модули: mdEscape
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = userLink;
const mdEscape_1 = require("./mdEscape");
function userLink(id, name) {
    const text = name || String(id);
    return `[${(0, mdEscape_1.escapeMarkdownV2)(text)}](tg://user?id=${id})`;
}
