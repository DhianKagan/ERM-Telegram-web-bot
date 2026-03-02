// Контроллер авторизации и профиля
// Основные модули: auth.service, utils/formatUser, services/service, utils/setTokenCookie
import service from './auth.service';
import formatUser from '../utils/formatUser';
import { writeLog } from '../services/service';
import setTokenCookie, {
  buildTokenCookieOptions,
} from '../utils/setTokenCookie';
import type { RequestWithUser } from '../types/request';
import { Request, Response, CookieOptions } from 'express';
import config from '../config';
import type { UserDocument } from '../db/model';
import { sendProblem } from '../utils/problem';
import { refreshToken } from './auth';
import { authPasswordLoginAttemptsTotal } from '../metrics';
import { recordPasswordLoginDiagnostic } from './authDiagnostics';
import {
  decodeLegacyToken,
  issueSession,
  revokeRefresh,
  rotateSession,
  tokenSettings,
} from '../services/token.service';
import { authBearerEnabled } from '../config';

const buildRefreshCookieOptions = (): CookieOptions => {
  const secure =
    process.env.COOKIE_SECURE === undefined
      ? process.env.NODE_ENV === 'production'
      : process.env.COOKIE_SECURE !== 'false';
  const opts: CookieOptions = {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    path: tokenSettings.refreshCookiePath,
    maxAge: tokenSettings.refreshTtl * 1000,
  };
  return opts;
};

const setRefreshCookie = (res: Response, refreshTokenValue: string): void => {
  res.cookie(
    tokenSettings.refreshCookieName,
    refreshTokenValue,
    buildRefreshCookieOptions(),
  );
};

const clearRefreshCookie = (res: Response): void => {
  const opts = buildRefreshCookieOptions();
  delete opts.maxAge;
  res.clearCookie(tokenSettings.refreshCookieName, opts);
};

export const sendCode = async (req: Request, res: Response) => {
  const { telegramId } = req.body;
  try {
    await service.sendCode(telegramId);
    res.json({ status: 'sent' });
  } catch (e) {
    sendProblem(req, res, {
      type: 'about:blank',
      title: 'Ошибка отправки кода',
      status: 400,
      detail: String((e as Error).message),
    });
  }
};

export const verifyCode = async (req: Request, res: Response) => {
  const { telegramId, code, username } = req.body;
  try {
    const token = await service.verifyCode(telegramId, code, username);
    setTokenCookie(res, token);
    if (authBearerEnabled) {
      const payload = decodeLegacyToken(token);
      const session = await issueSession(payload, {
        ip: req.ip,
        userAgent: req.get('user-agent') || undefined,
      });
      setRefreshCookie(res, session.refreshToken);
      res.json({ token, accessToken: session.accessToken });
      return;
    }
    res.json({ token });
  } catch (e) {
    sendProblem(req, res, {
      type: 'about:blank',
      title: 'Ошибка подтверждения кода',
      status: 400,
      detail: String((e as Error).message),
    });
  }
};

export const passwordLogin = async (req: Request, res: Response) => {
  const { username, password } = req.body;
  try {
    const token = await service.verifyPasswordLogin(username, password);
    authPasswordLoginAttemptsTotal.inc({ status: 'success' });
    recordPasswordLoginDiagnostic(true);
    setTokenCookie(res, token);
    res.json({ token });
  } catch (e) {
    authPasswordLoginAttemptsTotal.inc({ status: 'failure' });
    recordPasswordLoginDiagnostic(false, (e as Error)?.message);
    sendProblem(req, res, {
      type: 'about:blank',
      title: 'Ошибка входа по логину и паролю',
      status: 400,
      detail: String((e as Error).message),
    });
  }
};

export const login = async (req: Request, res: Response) => {
  const { username, password } = req.body;
  try {
    const legacyToken = await service.verifyPasswordLogin(username, password);
    const payload = decodeLegacyToken(legacyToken);
    const session = await issueSession(payload, {
      ip: req.ip,
      userAgent: req.get('user-agent') || undefined,
    });
    setRefreshCookie(res, session.refreshToken);
    res.json({ accessToken: session.accessToken });
  } catch (e) {
    sendProblem(req, res, {
      type: 'about:blank',
      title: 'Ошибка входа по логину и паролю',
      status: 400,
      detail: String((e as Error).message),
    });
  }
};

export const verifyInitData = async (req: Request, res: Response) => {
  try {
    const token = await service.verifyInitData(req.body.initData);
    setTokenCookie(res, token);
    res.json({ token });
  } catch (e) {
    sendProblem(req, res, {
      type: 'about:blank',
      title: 'Ошибка авторизации',
      status: 400,
      detail: String((e as Error).message),
    });
  }
};

export const profile = async (
  req: RequestWithUser,
  res: Response,
): Promise<void> => {
  const user = await service.getProfile(req.user!.id!);
  if (!user) {
    sendProblem(req, res, {
      type: 'about:blank',
      title: 'Пользователь не найден',
      status: 404,
      detail: 'Not Found',
    });
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
    sendProblem(req, res, {
      type: 'about:blank',
      title: 'Пользователь не найден',
      status: 404,
      detail: 'Not Found',
    });
    return;
  }
  await writeLog(`Профиль ${req.user!.id}/${req.user!.username} изменён`);
  res.json(formatUser(user));
};

export const logout = async (req: Request, res: Response) => {
  const opts: CookieOptions = buildTokenCookieOptions(config, undefined);
  delete opts.maxAge;
  res.clearCookie('token', opts);
  const refresh = (req.cookies as Record<string, string> | undefined)?.[
    tokenSettings.refreshCookieName
  ];
  if (refresh) {
    await revokeRefresh(refresh);
  }
  clearRefreshCookie(res);
  res.json({ status: 'ok' });
};

export const refresh = async (req: Request, res: Response) => {
  const refreshCookie = (req.cookies as Record<string, string> | undefined)?.[
    tokenSettings.refreshCookieName
  ];

  if (refreshCookie) {
    const session = await rotateSession(refreshCookie, {
      ip: req.ip,
      userAgent: req.get('user-agent') || undefined,
    });
    if (!session) {
      clearRefreshCookie(res);
      res.sendStatus(401);
      return;
    }
    setRefreshCookie(res, session.refreshToken);
    res.json({ accessToken: session.accessToken });
    return;
  }

  const old = (req.cookies as Record<string, string> | undefined)?.token;
  if (!old) {
    res.sendStatus(401);
    return;
  }
  const token = refreshToken(old);
  setTokenCookie(res, token);
  res.json({ token });
};

export const codes = service.codes;
export const adminCodes = service.adminCodes;
