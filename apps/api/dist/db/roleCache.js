"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveRoleId = resolveRoleId;
exports.clearRoleCache = clearRoleCache;
const model_1 = require("./model");
const resolvedRoles = new Map();
const pendingLookups = new Map();
function normalizeRoleName(name) {
    return (name || '').trim().toLowerCase();
}
async function loadRoleId(name) {
    const normalized = normalizeRoleName(name);
    if (!normalized)
        return null;
    const role = await model_1.Role.findOneAndUpdate({ name: normalized }, { $setOnInsert: { name: normalized, permissions: [] } }, { upsert: true, new: true, projection: { _id: 1 } });
    return role ? role._id : null;
}
async function resolveRoleId(name) {
    var _a;
    const normalized = normalizeRoleName(name);
    if (!normalized)
        return null;
    if (resolvedRoles.has(normalized)) {
        return (_a = resolvedRoles.get(normalized)) !== null && _a !== void 0 ? _a : null;
    }
    let lookup = pendingLookups.get(normalized);
    if (!lookup) {
        lookup = loadRoleId(normalized).then((value) => {
            pendingLookups.delete(normalized);
            resolvedRoles.set(normalized, value);
            return value;
        });
        pendingLookups.set(normalized, lookup);
    }
    return lookup;
}
function clearRoleCache(name) {
    if (name) {
        const normalized = normalizeRoleName(name);
        if (!normalized)
            return;
        resolvedRoles.delete(normalized);
        pendingLookups.delete(normalized);
        return;
    }
    resolvedRoles.clear();
    pendingLookups.clear();
}
