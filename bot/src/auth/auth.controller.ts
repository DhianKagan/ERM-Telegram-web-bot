// Контроллер авторизации и профиля
// Основные модули: auth.service, config
const service = require('./auth.service.ts');
const config = require('../config');
const formatUser = require('../utils/formatUser');
const { writeLog } = require('../services/service');

exports.sendCode = async (req, res) => {
  const { telegramId } = req.body;
  try {
    await service.sendCode(telegramId);
    res.json({ status: 'sent' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

exports.verifyCode = async (req, res) => {
  const { telegramId, code, username } = req.body;
  try {
    const token = await service.verifyCode(telegramId, code, username);
  const secure = process.env.NODE_ENV === 'production';
  const cookieOpts = {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
  if (secure) {
    cookieOpts.domain = config.cookieDomain || new URL(config.appUrl).hostname;
  }
  res.cookie('token', token, cookieOpts);
  const preview = token.slice(0, 8);
  writeLog(`Установлена cookie token:${preview} domain:${cookieOpts.domain || 'none'}`);
    res.json({ token });
  } catch (e) {
    const status = e.message === 'invalid code' ? 400 : 403;
    res.status(status).json({ error: e.message });
  }
};

exports.verifyInitData = async (req, res) => {
  try {
    const token = await service.verifyInitData(req.body.initData);
  const secure = process.env.NODE_ENV === 'production';
  const cookieOpts = {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };
    if (secure) {
      cookieOpts.domain = config.cookieDomain || new URL(config.appUrl).hostname;
    }
    res.cookie('token', token, cookieOpts);
    const preview = token.slice(0, 8);
    writeLog(`Установлена cookie token:${preview} domain:${cookieOpts.domain || 'none'}`);
    res.json({ token });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

exports.profile = async (req, res) => {
  const user = await service.getProfile(req.user.id);
  if (!user) return res.sendStatus(404);
  res.json(formatUser(user));
};

exports.updateProfile = async (req, res) => {
  const user = await service.updateProfile(req.user.id, {
    name: req.body.name,
    phone: req.body.phone,
    mobNumber: req.body.mobNumber,
  });
  if (!user) return res.sendStatus(404);
  res.json(formatUser(user));
};

exports.codes = service.codes;
exports.adminCodes = service.adminCodes;
