// Сервис авторизации: отправка и проверка кодов входа
// Основные модули: otp, queries, userInfoService, writeLog, roleCache
import * as otp from '../services/otp';
import { generateToken, generateShortToken } from './auth';
import {
  getUser,
  getUserByUsername,
  createUser,
  updateUser,
  accessByRole,
} from '../db/queries';
import { hasAccess, ACCESS_ADMIN, ACCESS_TASK_DELETE } from '../utils/accessMask';
import { getMemberStatus } from '../services/userInfoService';
import { writeLog } from '../services/service';
import { resolveRoleId } from '../db/roleCache';
import type { UserDocument } from '../db/model';
import { verifyPassword } from './password';

const normalizeEnv = (value: string | undefined): string =>
  String(value || '').trim();

const parseServiceUserId = (value: string | undefined): number => {
  const normalized = normalizeEnv(value);
  if (!/^\d+$/.test(normalized)) {
    return 900000001;
  }
  const parsed = Number.parseInt(normalized, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? 900000001 : parsed;
};

const parseAccessLevel = (value: string | undefined, fallback: number): number => {
  const normalized = normalizeEnv(value);
  if (!normalized) {
    return fallback;
  }
  if (!/^\d+$/.test(normalized)) {
    return fallback;
  }
  const parsed = Number.parseInt(normalized, 10);
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 15) {
    return fallback;
  }
  return parsed;
};

const superAdminUsername = normalizeEnv(process.env.SUPER_ADMIN_LOGIN);
const superAdminPassword = normalizeEnv(process.env.SUPER_ADMIN_PASSWORD);
const superAdminEnabled = Boolean(superAdminUsername && superAdminPassword);
const superAdminTelegramId = parseServiceUserId(
  process.env.SUPER_ADMIN_TELEGRAM_ID,
);
const superAdminAccessLevel =
  parseAccessLevel(process.env.SUPER_ADMIN_ACCESS_LEVEL, 10) |
  ACCESS_ADMIN |
  ACCESS_TASK_DELETE;

async function ensureSuperAdminUser(username: string): Promise<UserDocument> {
  const existingById = await getUser(superAdminTelegramId);
  const existingByUsername = await getUserByUsername(username, true);
  const current = existingById || existingByUsername;
  const adminRoleId = await resolveRoleId('admin');
  if (!adminRoleId) {
    throw new Error('Не найдена роль admin');
  }

  if (!current) {
    return createUser(superAdminTelegramId, username, adminRoleId.toString(), {
      is_service_account: false,
    });
  }

  const updated = await updateUser(current.telegram_id, {
    username,
    roleId: adminRoleId,
    role: 'admin',
    is_service_account: false,
  });

  if (!updated) {
    throw new Error('Не удалось обновить супер-администратора');
  }

  return updated;
}

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
    if (e instanceof Error && e.message === 'not in group') throw e;
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
  const tokenAccess =
    hasDeleteMask && currentAccess !== null ? currentAccess | access : access;
  if (currentAccess === null || (currentAccess !== access && !hasDeleteMask)) {
    await updateUser(telegramId, { role });
  }
  const token = generateToken({
    id: telegramId,
    username: u.username || '',
    role,
    access: tokenAccess,
    is_service_account: false,
  });
  await writeLog(`Вход пользователя ${telegramId}/${u.username}`);
  return token;
}

async function verifyPasswordLogin(username: string, password: string) {
  const normalizedUsername = String(username || '').trim();
  const normalizedPassword = String(password || '').trim();
  if (!normalizedUsername) {
    throw new Error('username required');
  }
  if (superAdminEnabled) {
    if (
      normalizedUsername === superAdminUsername &&
      normalizedPassword === superAdminPassword
    ) {
      const user = await ensureSuperAdminUser(normalizedUsername);
      const token = generateToken({
        id: String(user.telegram_id),
        username: user.username || normalizedUsername,
        role: 'admin',
        access: superAdminAccessLevel,
        is_service_account: false,
      });
      await writeLog(`Вход супер-администратора ${user.telegram_id}/${user.username}`);
      return token;
    }
  }
  const user = await getUserByUsername(normalizedUsername, true);
  if (!user) {
    throw new Error('invalid credentials');
  }
  if (!user.is_service_account) {
    throw new Error('password login is allowed only for service accounts');
  }
  if (!user.password_hash || !verifyPassword(normalizedPassword, user.password_hash)) {
    throw new Error('invalid credentials');
  }
  const role = user.role || 'user';
  const access = accessByRole(role);
  const currentAccess = typeof user.access === 'number' ? user.access : null;
  const hasDeleteMask =
    currentAccess !== null && hasAccess(currentAccess, ACCESS_TASK_DELETE);
  const tokenAccess =
    hasDeleteMask && currentAccess !== null ? currentAccess | access : access;
  const token = generateToken({
    id: String(user.telegram_id),
    username: user.username || '',
    role,
    access: tokenAccess,
    is_service_account: Boolean(user.is_service_account),
  });
  await writeLog(
    `Вход сервисного аккаунта ${user.telegram_id}/${user.username}`,
  );
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
  const tokenAccess =
    hasDeleteMask && currentAccess !== null ? currentAccess | access : access;
  if (currentAccess === null || (currentAccess !== access && !hasDeleteMask)) {
    await updateUser(telegramId, { role });
  }
  const token = generateToken({
    id: telegramId,
    username: user.username || '',
    role,
    access: tokenAccess,
    is_service_account: false,
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
  const tokenAccess =
    hasDeleteMask && currentAccess !== null ? currentAccess | access : access;
  if (currentAccess === null || (currentAccess !== access && !hasDeleteMask)) {
    await updateUser(telegramId, { role });
  }
  const token = generateShortToken({
    id: telegramId,
    username: user.username || '',
    role,
    access: tokenAccess,
    is_service_account: false,
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
  verifyPasswordLogin,
  verifyInitData,
  verifyTmaLogin,
  getProfile,
  updateProfile,
  codes: otp.codes,
  adminCodes: otp.adminCodes,
};
