// Сервис авторизации: отправка и проверка кодов входа
// Основные модули: otp, queries, userInfoService, writeLog
import * as otp from '../services/otp';
import {
  generateToken,
  generateShortToken,
  refreshToken,
  type Payload,
} from './auth';
import { getUser, createUser, updateUser, accessByRole } from '../db/queries';
import { getMemberStatus } from '../services/userInfoService';
import { writeLog } from '../services/service';
import config from '../config';
import { Types } from 'mongoose';
import type { UserDocument } from '../db/model';

async function sendCode(telegramId: number | string) {
  if (!telegramId) throw new Error('telegramId required');
  const user = await getUser(telegramId);
  const roleId = user?.roleId?.toString();
  if (roleId === config.adminRoleId) {
    await otp.sendAdminCode({ telegramId: Number(telegramId) });
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
  let verified;
  if (roleId === config.adminRoleId || otp.adminCodes.has(telegramId)) {
    verified = otp.verifyAdminCode({ telegramId: Number(telegramId), code });
    if (verified && user && roleId !== config.adminRoleId) {
      user = await updateUser(telegramId, {
        roleId: new Types.ObjectId(config.adminRoleId),
      });
      await writeLog(`Пользователь ${telegramId} повышен до администратора`);
      roleId = config.adminRoleId;
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
  if (!u)
    u = await createUser(telegramId, username, roleId || config.userRoleId);
  const role =
    roleId === config.adminRoleId
      ? 'admin'
      : roleId === config.managerRoleId
        ? 'manager'
        : 'user';
  const access = accessByRole(role);
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
    user = await createUser(
      telegramId,
      userData.username || '',
      config.userRoleId,
    );
  }
  const role = user.role || 'user';
  const access = user.access || 1;
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
    user = await createUser(
      telegramId,
      userData.username || '',
      config.userRoleId,
    );
  }
  const role = user.role || 'user';
  const access = user.access || 1;
  const token = generateShortToken({
    id: telegramId,
    username: user.username || '',
    role,
    access,
  });
  await writeLog(`Вход мини-приложения ${telegramId}/${user.username}`);
  return token;
}

function refresh(user: Payload) {
  return refreshToken(user);
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
  refresh,
  getProfile,
  updateProfile,
  codes: otp.codes,
  adminCodes: otp.adminCodes,
};
