// Роуты регистрации, входа и профиля
// Роут только профиля пользователя
import { Router, RequestHandler } from 'express';
import * as authCtrl from '../auth/auth.controller';
import { verifyToken, asyncHandler } from '../api/middleware';
import validateDto from '../middleware/validateDto';
import {
  SendCodeDto,
  VerifyCodeDto,
  VerifyInitDto,
  UpdateProfileDto,
} from '../dto/auth.dto';

interface SendCodeBody {
  telegramId: number;
}
interface SendCodeResponse {
  status?: string;
  error?: string;
}

interface VerifyCodeBody {
  telegramId: number;
  code: string;
  username?: string;
}
interface TokenResponse {
  token?: string;
  error?: string;
}

interface VerifyInitBody {
  initData: string;
}

interface UpdateProfileBody {
  name?: string;
  phone?: string;
  mobNumber?: string;
}

const router = Router();

router.post<unknown, SendCodeResponse, SendCodeBody>(
  '/send_code',
  ...validateDto(SendCodeDto),
  asyncHandler(
    authCtrl.sendCode as RequestHandler<
      unknown,
      SendCodeResponse,
      SendCodeBody
    >,
  ),
);

router.post<unknown, TokenResponse, VerifyCodeBody>(
  '/verify_code',
  ...validateDto(VerifyCodeDto),
  asyncHandler(
    authCtrl.verifyCode as RequestHandler<
      unknown,
      TokenResponse,
      VerifyCodeBody
    >,
  ),
);

router.post<unknown, TokenResponse, VerifyInitBody>(
  '/verify_init',
  ...validateDto(VerifyInitDto),
  asyncHandler(
    authCtrl.verifyInitData as RequestHandler<
      unknown,
      TokenResponse,
      VerifyInitBody
    >,
  ),
);

router.get('/profile', verifyToken, authCtrl.profile);
router.patch<unknown, unknown, UpdateProfileBody>(
  '/profile',
  verifyToken,
  ...validateDto(UpdateProfileDto),
  asyncHandler(
    authCtrl.updateProfile as RequestHandler<
      unknown,
      unknown,
      UpdateProfileBody
    >,
  ),
);

export default router;

// Совместимость с CommonJS
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(module as any).exports = router;
