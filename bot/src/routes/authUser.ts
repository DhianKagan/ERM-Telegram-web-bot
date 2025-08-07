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

router.post(
  '/send_code',
  ...(validateDto(SendCodeDto) as RequestHandler[]),
  asyncHandler(authCtrl.sendCode as any),
);

router.post(
  '/verify_code',
  ...(validateDto(VerifyCodeDto) as RequestHandler[]),
  asyncHandler(authCtrl.verifyCode as any),
);

router.post(
  '/verify_init',
  ...(validateDto(VerifyInitDto) as RequestHandler[]),
  asyncHandler(authCtrl.verifyInitData as any),
);

router.get('/profile', verifyToken as RequestHandler, authCtrl.profile as unknown as RequestHandler);
router.patch(
  '/profile',
  verifyToken as RequestHandler,
  ...(validateDto(UpdateProfileDto) as RequestHandler[]),
  asyncHandler(authCtrl.updateProfile as any),
);

export default router;

// Совместимость с CommonJS
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(module as any).exports = router;
