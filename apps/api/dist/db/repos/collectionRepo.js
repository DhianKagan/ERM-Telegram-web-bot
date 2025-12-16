"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.create = create;
exports.list = list;
exports.update = update;
exports.remove = remove;
// Назначение файла: репозиторий элементов коллекции
// Основные модули: mongoose, модели CollectionItem
const mongoose_1 = require("mongoose");
const CollectionItem_1 = require("../models/CollectionItem");
async function create(data) {
    const payload = {
        type: data.type,
        name: data.name,
        value: data.value,
    };
    if (data.meta) {
        payload.meta = data.meta;
    }
    if (data._id) {
        payload._id =
            typeof data._id === 'string' ? new mongoose_1.Types.ObjectId(data._id) : data._id;
    }
    return CollectionItem_1.CollectionItem.create(payload);
}
async function list(filters = {}, page = 1, limit = 20) {
    const q = {};
    if (filters.type)
        q.type = filters.type;
    if (filters.name)
        q.name = filters.name;
    if (filters.value)
        q.value = filters.value;
    if (filters.search)
        q.$text = { $search: filters.search };
    const total = await CollectionItem_1.CollectionItem.countDocuments(q);
    const items = await CollectionItem_1.CollectionItem.find(q)
        .skip((page - 1) * limit)
        .limit(limit)
        .exec();
    return { items, total };
}
async function update(id, data) {
    const set = {};
    const unset = {};
    if (Object.prototype.hasOwnProperty.call(data, 'type') &&
        data.type !== undefined) {
        set.type = data.type;
    }
    if (Object.prototype.hasOwnProperty.call(data, 'name')) {
        if (data.name !== undefined) {
            set.name = data.name;
        }
        else {
            unset.name = '';
        }
    }
    if (Object.prototype.hasOwnProperty.call(data, 'value')) {
        if (data.value !== undefined) {
            set.value = data.value;
        }
        else {
            unset.value = '';
        }
    }
    if (Object.prototype.hasOwnProperty.call(data, 'meta')) {
        if (data.meta === undefined) {
            unset.meta = '';
        }
        else {
            set.meta = data.meta;
        }
    }
    const updatePayload = {};
    if (Object.keys(set).length) {
        updatePayload.$set = set;
    }
    if (Object.keys(unset).length) {
        updatePayload.$unset = unset;
    }
    if (!Object.keys(updatePayload).length) {
        return CollectionItem_1.CollectionItem.findById(id);
    }
    return CollectionItem_1.CollectionItem.findByIdAndUpdate(id, updatePayload, {
        new: true,
        runValidators: true,
    });
}
async function remove(id) {
    return CollectionItem_1.CollectionItem.findByIdAndDelete(id);
}
exports.default = { create, list, update, remove };
