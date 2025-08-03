// Контроллер авторизации и профиля
// Основные модули: auth.service, utils/formatUser, services/service, utils/setTokenCookie
import service from './auth.service';
import formatUser from '../utils/formatUser';
import { writeLog } from '../services/service.js';
import setTokenCookie from '../utils/setTokenCookie';

export const sendCode = async (req, res) => {
  const { telegramId } = req.body;
  try {
    await service.sendCode(telegramId);
    res.json({ status: 'sent' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

export const verifyCode = async (req, res) => {
  const { telegramId, code, username } = req.body;
  try {
    const token = await service.verifyCode(telegramId, code, username);
    setTokenCookie(res, token);
    res.json({ token });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

export const verifyInitData = async (req, res) => {
  try {
    const token = await service.verifyInitData(req.body.initData);
    setTokenCookie(res, token);
    res.json({ token });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

export const profile = async (req, res) => {
  const user = await service.getProfile(req.user.id);
  if (!user) return res.sendStatus(404);
  res.json(formatUser(user));
};

export const updateProfile = async (req, res) => {
  const user = await service.updateProfile(req.user.id, req.body);
  if (!user) return res.sendStatus(404);
  await writeLog(`Профиль ${req.user.id}/${req.user.username} изменён`);
  res.json(formatUser(user));
};

export const codes = service.codes;
export const adminCodes = service.adminCodes;
