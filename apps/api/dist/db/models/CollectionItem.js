"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollectionItem = void 0;
// Назначение файла: модель универсальной коллекции
// Основные модули: mongoose
const mongoose_1 = require("mongoose");
const collectionItemSchema = new mongoose_1.Schema({
    type: { type: String, required: true },
    name: { type: String, required: true },
    value: {
        type: String,
        required() {
            return this.type !== 'departments';
        },
        validate: {
            validator(value) {
                if (this.type === 'departments') {
                    return typeof value === 'string';
                }
                return typeof value === 'string' && value.trim().length > 0;
            },
            message: 'Значение элемента обязательно',
        },
    },
    meta: { type: mongoose_1.Schema.Types.Mixed, default: undefined },
});
collectionItemSchema.index({ type: 1, name: 1 }, { name: 'type_name_unique', unique: true });
collectionItemSchema.index({ type: 'text', name: 'text', value: 'text' }, { name: 'search_text' });
exports.CollectionItem = (0, mongoose_1.model)('CollectionItem', collectionItemSchema);
