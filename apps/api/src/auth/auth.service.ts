// Сервис авторизации: отправка и проверка кодов входа
// Основные модули: otp, queries, userInfoService, writeLog, roleCache
import * as otp from '../services/otp';
import { generateToken, generateShortToken } from './auth';
import { getUser, createUser, updateUser, accessByRole } from '../db/queries';
import { hasAccess, ACCESS_TASK_DELETE } from '../utils/accessMask';
import { getMemberStatus } from '../services/userInfoService';
import { writeLog } from '../services/service';
import { resolveRoleId } from '../db/roleCache';
import type { UserDocument } from '../db/model';

async function sendCode(telegramId: number | string) {
  if (!telegramId) throw new Error('telegramId required');
  const user = await getUser(telegramId);
  const roleId = user?.roleId?.toString();
  const adminRoleId = await resolveRoleId('admin');
  const managerRoleId = await resolveRoleId('manager');
  if (adminRoleId && roleId === adminRoleId.toString()) {
    await otp.sendAdminCode({ telegramId: Number(telegramId) });
  } else if (managerRoleId && roleId === managerRoleId.toString()) {
    await otp.sendManagerCode({ telegramId: Number(telegramId) });
  } else {
    await otp.sendCode({ telegramId: Number(telegramId) });
  }
}

async function verifyCode(
  id: string | number,
  code: string,
  username?: string,
) {
  const telegramId = String(id);
  if (!/^[0-9]+$/.test(telegramId)) throw new Error('Invalid telegramId');
  let user = await getUser(telegramId);
  let roleId = user?.roleId?.toString();
  const adminRoleId = await resolveRoleId('admin');
  const adminRoleIdString = adminRoleId ? adminRoleId.toString() : null;
  let verified;
  if (roleId === adminRoleIdString || otp.adminCodes.has(telegramId)) {
    verified = otp.verifyAdminCode({ telegramId: Number(telegramId), code });
    if (verified && user && roleId !== adminRoleIdString) {
      if (!adminRoleId) {
        throw new Error('Не найдена роль admin');
      }
      user = await updateUser(telegramId, {
        roleId: adminRoleId,
      });
      await writeLog(`Пользователь ${telegramId} повышен до администратора`);
      roleId = adminRoleIdString ?? undefined;
    }
  } else {
    verified = otp.verifyCode({ telegramId: Number(telegramId), code });
  }
  if (!verified) throw new Error('invalid code');
  try {
    const status = await getMemberStatus(Number(telegramId));
    if (!['creator', 'administrator', 'member'].includes(status)) {
      throw new Error('not in group');
    }
  } catch (e) {
    if (e.message === 'not in group') throw e;
    throw new Error('member check failed');
  }
  let u = user;
  if (!u) {
    u = await createUser(telegramId, username, roleId || undefined);
    roleId = u.roleId?.toString() || roleId;
  }
  const managerRoleId = await resolveRoleId('manager');
  const managerRoleIdString = managerRoleId ? managerRoleId.toString() : null;
  const role =
    roleId === adminRoleIdString
      ? 'admin'
      : roleId === managerRoleIdString
        ? 'manager'
        : 'user';
  const access = accessByRole(role);
  const currentAccess = typeof u.access === 'number' ? u.access : null;
  const hasDeleteMask =
    currentAccess !== null && hasAccess(currentAccess, ACCESS_TASK_DELETE);
  if (currentAccess === null || (currentAccess !== access && !hasDeleteMask)) {
    await updateUser(telegramId, { role });
  }
  const token = generateToken({
    id: telegramId,
    username: u.username || '',
    role,
    access,
  });
  await writeLog(`Вход пользователя ${telegramId}/${u.username}`);
  return token;
}

import verifyInit from '../utils/verifyInitData';

async function verifyInitData(initData: string) {
  let data;
  try {
    data = verifyInit(initData);
  } catch {
    throw new Error('invalid initData');
  }
  const userData = data.user;
  if (!userData) throw new Error('invalid user');
  const telegramId = String(userData.id);
  if (!telegramId) throw new Error('no user id');
  let user = await getUser(telegramId);
  if (!user) {
    user = await createUser(telegramId, userData.username || '');
  }
  const role = user.role || 'user';
  const access = accessByRole(role);
  const currentAccess = typeof user.access === 'number' ? user.access : null;
  const hasDeleteMask =
    currentAccess !== null && hasAccess(currentAccess, ACCESS_TASK_DELETE);
  if (currentAccess === null || (currentAccess !== access && !hasDeleteMask)) {
    await updateUser(telegramId, { role });
  }
  const token = generateToken({
    id: telegramId,
    username: user.username || '',
    role,
    access,
  });
  await writeLog(`Вход пользователя ${telegramId}/${user.username}`);
  return token;
}

async function verifyTmaLogin(initData: ReturnType<typeof verifyInit>) {
  const userData = initData.user;
  if (!userData) throw new Error('invalid user');
  const telegramId = String(userData.id);
  if (!telegramId) throw new Error('no user id');
  let user = await getUser(telegramId);
  if (!user) {
    user = await createUser(telegramId, userData.username || '');
  }
  const role = user.role || 'user';
  const access = accessByRole(role);
  const currentAccess = typeof user.access === 'number' ? user.access : null;
  const hasDeleteMask =
    currentAccess !== null && hasAccess(currentAccess, ACCESS_TASK_DELETE);
  if (currentAccess === null || (currentAccess !== access && !hasDeleteMask)) {
    await updateUser(telegramId, { role });
  }
  const token = generateShortToken({
    id: telegramId,
    username: user.username || '',
    role,
    access,
  });
  await writeLog(`Вход мини-приложения ${telegramId}/${user.username}`);
  return token;
}

async function getProfile(id: string | number) {
  const user = await getUser(id);
  return user || null;
}

async function updateProfile(
  id: string | number,
  data: Omit<Partial<UserDocument>, 'access'>,
) {
  const user = await updateUser(id, data);
  return user || null;
}

export default {
  sendCode,
  verifyCode,
  verifyInitData,
  verifyTmaLogin,
  getProfile,
  updateProfile,
  codes: otp.codes,
  adminCodes: otp.adminCodes,
};
