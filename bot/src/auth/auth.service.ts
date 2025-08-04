// Сервис авторизации: отправка и проверка кодов входа
// Основные модули: otp, queries, userInfoService, writeLog
import otp from '../services/otp';
import { generateToken } from './auth';
import { getUser, createUser, updateUser } from '../db/queries.js';
import { getMemberStatus } from '../services/userInfoService';
import { writeLog } from '../services/service';
import config from '../config.js';

async function sendCode(telegramId) {
  if (!telegramId) throw new Error('telegramId required');
  const user = await getUser(telegramId);
  const roleId = user?.roleId?.toString();
  if (roleId === config.adminRoleId) {
    await otp.sendAdminCode({ telegramId });
  } else {
    await otp.sendCode({ telegramId });
  }
}

async function verifyCode(id, code, username) {
  const telegramId = String(id);
  if (!/^[0-9]+$/.test(telegramId)) throw new Error('Invalid telegramId');
  let user = await getUser(telegramId);
  let roleId = user?.roleId?.toString();
  let verified;
  if (roleId === config.adminRoleId || otp.adminCodes.has(telegramId)) {
    verified = otp.verifyAdminCode({ telegramId, code });
    if (verified && user && roleId !== config.adminRoleId) {
      user = await updateUser(telegramId, {
        roleId: config.adminRoleId,
        role: 'admin',
        access: 2,
      });
      await writeLog(`Пользователь ${telegramId} повышен до администратора`);
      roleId = config.adminRoleId;
    }
  } else {
    verified = otp.verifyCode({ telegramId, code });
  }
  if (!verified) throw new Error('invalid code');
  try {
    const status = await getMemberStatus(telegramId);
    if (!['creator', 'administrator', 'member'].includes(status)) {
      throw new Error('not in group');
    }
  } catch (e) {
    if (e.message === 'not in group') throw e;
    throw new Error('member check failed');
  }
  let u = user;
  if (!u)
    u = await createUser(telegramId, username, roleId || config.userRoleId, {
      access: roleId === config.adminRoleId ? 2 : 1,
    });
  const role = roleId === config.adminRoleId ? 'admin' : 'user';
  const access = role === 'admin' ? 2 : 1;
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

async function verifyInitData(initData) {
  if (!initData || !verifyInit(initData)) throw new Error('invalid initData');
  const params = new URLSearchParams(initData);
  let userData;
  try {
    userData = JSON.parse(params.get('user') || '{}');
  } catch {
    throw new Error('invalid user');
  }
  const telegramId = String(userData.id);
  if (!telegramId) throw new Error('no user id');
  let user = await getUser(telegramId);
  if (!user) {
    user = await createUser(
      telegramId,
      userData.username || '',
      config.userRoleId,
      { access: 1 },
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

async function getProfile(id) {
  const user = await getUser(id);
  return user || null;
}

async function updateProfile(id, data) {
  const user = await updateUser(id, data);
  return user || null;
}

export default {
  sendCode,
  verifyCode,
  verifyInitData,
  getProfile,
  updateProfile,
  codes: otp.codes,
  adminCodes: otp.adminCodes,
};
module.exports = {
  sendCode,
  verifyCode,
  verifyInitData,
  getProfile,
  updateProfile,
  codes: otp.codes,
  adminCodes: otp.adminCodes,
};
