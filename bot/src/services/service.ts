// Сервис для управления сущностями MongoDB через единый набор функций
// Модули: db/queries, wgLogEngine
import * as q from '../db/queries';
import { writeLog, listLogs as wgListLogs } from './wgLogEngine';

export const getTask = q.getTask;
export const updateTask = q.updateTask;
export const updateTaskStatus = q.updateTaskStatus;
export const createUser = q.createUser;
export const listUsers = q.listUsers;
export const updateUser = q.updateUser;
export const listRoles = q.listRoles;
export const getRole = q.getRole;
export const updateRole = q.updateRole;
export const getUser = q.getUser;
export { writeLog };
export const listLogs = (params: Record<string, unknown>) => wgListLogs(params);
export const searchTasks = q.searchTasks;
export const listMentionedTasks = q.listMentionedTasks;
export const deleteTask = q.deleteTask;

