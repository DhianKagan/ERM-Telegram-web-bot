// Контроллер авторизации и профиля
// Основные модули: auth.service, utils/formatUser, services/service, utils/setTokenCookie
import service from './auth.service';
import formatUser from '../utils/formatUser';
import { writeLog } from '../services/service';
import setTokenCookie from '../utils/setTokenCookie';
import type { RequestWithUser } from '../types/request';
import { Request, Response } from 'express';
import type { UserDocument } from '../db/model';

export const sendCode = async (req: Request, res: Response) => {
  const { telegramId } = req.body;
  try {
    await service.sendCode(telegramId);
    res.json({ status: 'sent' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

export const verifyCode = async (req: Request, res: Response) => {
  const { telegramId, code, username } = req.body;
  try {
    const token = await service.verifyCode(telegramId, code, username);
    setTokenCookie(res, token);
    res.json({ token });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

export const verifyInitData = async (req: Request, res: Response) => {
  try {
    const token = await service.verifyInitData(req.body.initData);
    setTokenCookie(res, token);
    res.json({ token });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

export const profile = async (
  req: RequestWithUser,
  res: Response,
): Promise<void> => {
  const user = await service.getProfile(req.user!.id!);
  if (!user) {
    res.sendStatus(404);
    return;
  }
  res.json(formatUser(user));
};

export const updateProfile = async (
  req: RequestWithUser,
  res: Response,
): Promise<void> => {
  const user = await service.updateProfile(
    req.user!.id!,
    req.body as Partial<UserDocument>,
  );
  if (!user) {
    res.sendStatus(404);
    return;
  }
  await writeLog(`Профиль ${req.user!.id}/${req.user!.username} изменён`);
  res.json(formatUser(user));
};

export const codes = service.codes;
export const adminCodes = service.adminCodes;
