// Роуты регистрации, входа и профиля
// Роут только профиля пользователя
import { Router, RequestHandler } from 'express';
import * as authCtrl from '../auth/auth.controller';
import { verifyToken, asyncHandler } from '../api/middleware';
import createRateLimiter from '../utils/rateLimiter';
import { rateLimits } from '../rateLimits';
import validateDto from '../middleware/validateDto';
import {
  SendCodeDto,
  VerifyCodeDto,
  VerifyInitDto,
  UpdateProfileDto,
} from '../dto/auth.dto';

const router = Router();
const authLimiter = createRateLimiter(rateLimits.auth);
router.use(authLimiter as unknown as RequestHandler);

router.post(
  '/send_code',
  ...(validateDto(SendCodeDto) as RequestHandler[]),
  asyncHandler(authCtrl.sendCode),
);

router.post(
  '/verify_code',
  ...(validateDto(VerifyCodeDto) as RequestHandler[]),
  asyncHandler(authCtrl.verifyCode),
);

router.post(
  '/verify_init',
  ...(validateDto(VerifyInitDto) as RequestHandler[]),
  asyncHandler(authCtrl.verifyInitData),
);

router.get(
  '/profile',
  verifyToken as RequestHandler,
  authCtrl.profile as unknown as RequestHandler,
);
router.patch(
  '/profile',
  verifyToken as RequestHandler,
  ...(validateDto(UpdateProfileDto) as RequestHandler[]),
  asyncHandler(authCtrl.updateProfile),
);

export default router;
