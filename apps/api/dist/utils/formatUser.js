"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = formatUser;
function formatUser(user) {
    if (!user)
        return null;
    const obj = user.toObject ? user.toObject() : { ...user };
    obj.telegram_username = obj.username;
    obj.username = String(obj.telegram_id ?? '');
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
