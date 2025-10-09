// Роуты регистрации, входа, обновления сессии и профиля
// Описывает send_code, verify_code, verify_init, logout, refresh и profile
// Модули: express, auth.controller, middleware/auth
import { Router, RequestHandler } from 'express';
import * as authCtrl from '../auth/auth.controller';
import { asyncHandler } from '../api/middleware';
import authMiddleware from '../middleware/auth';
import createRateLimiter from '../utils/rateLimiter';
import { rateLimits } from '../rateLimits';
import validateDto from '../middleware/validateDto';
import {
  SendCodeDto,
  VerifyCodeDto,
  VerifyInitDto,
  UpdateProfileDto,
} from '../dto/auth.dto';

const router: Router = Router();
const authLimiter = createRateLimiter(rateLimits.auth);

router.post(
  '/send_code',
  authLimiter as unknown as RequestHandler,
  ...(validateDto(SendCodeDto) as RequestHandler[]),
  asyncHandler(authCtrl.sendCode),
);

router.post(
  '/verify_code',
  authLimiter as unknown as RequestHandler,
  ...(validateDto(VerifyCodeDto) as RequestHandler[]),
  asyncHandler(authCtrl.verifyCode),
);

router.post(
  '/verify_init',
  authLimiter as unknown as RequestHandler,
  ...(validateDto(VerifyInitDto) as RequestHandler[]),
  asyncHandler(authCtrl.verifyInitData),
);

router.post(
  '/logout',
  authLimiter as unknown as RequestHandler,
  authCtrl.logout as unknown as RequestHandler,
);
router.post(
  '/refresh',
  authMiddleware(),
  authLimiter as unknown as RequestHandler,
  authCtrl.refresh as unknown as RequestHandler,
);

router.get(
  '/profile',
  authMiddleware(),
  authLimiter as unknown as RequestHandler,
  authCtrl.profile as unknown as RequestHandler,
);
router.patch(
  '/profile',
  authMiddleware(),
  authLimiter as unknown as RequestHandler,
  ...(validateDto(UpdateProfileDto) as RequestHandler[]),
  asyncHandler(authCtrl.updateProfile),
);

export default router;
