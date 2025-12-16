"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = formatUser;
function formatUser(user) {
    var _a;
    if (!user)
        return null;
    const obj = user.toObject ? user.toObject() : { ...user };
    obj.telegram_username = obj.username;
    obj.username = String((_a = obj.telegram_id) !== null && _a !== void 0 ? _a : '');
    if (obj.roleId)
        obj.roleId = String(obj.roleId);
    if (obj.departmentId)
        obj.departmentId = String(obj.departmentId);
    if (obj.divisionId)
        obj.divisionId = String(obj.divisionId);
    if (obj.positionId)
        obj.positionId = String(obj.positionId);
    return obj;
}
