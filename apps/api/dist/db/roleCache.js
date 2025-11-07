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
    const role = await model_1.Role.findOne({ name }).select({ _id: 1 });
    return role ? role._id : null;
}
async function resolveRoleId(name) {
    const normalized = normalizeRoleName(name);
    if (!normalized)
        return null;
    if (resolvedRoles.has(normalized)) {
        return resolvedRoles.get(normalized) ?? null;
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
