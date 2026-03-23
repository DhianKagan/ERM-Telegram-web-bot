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
  PasswordLoginDto,
  UpdateProfileDto,
} from '../dto/auth.dto';
import { authBearerEnabled } from '../config';

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
  '/login_password',
  authLimiter as unknown as RequestHandler,
  ...(validateDto(PasswordLoginDto) as RequestHandler[]),
  asyncHandler(authCtrl.passwordLogin),
);

router.post(
  '/login',
  authLimiter as unknown as RequestHandler,
  ...(validateDto(PasswordLoginDto) as RequestHandler[]),
  asyncHandler(authCtrl.login),
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
  asyncHandler(authCtrl.logout),
);
router.post(
  '/refresh',
  authLimiter as unknown as RequestHandler,
  asyncHandler(authCtrl.refresh),
);

router.get(
  '/profile',
  authMiddleware({ bearerOnly: authBearerEnabled }),
  authLimiter as unknown as RequestHandler,
  asyncHandler(authCtrl.profile),
);
router.patch(
  '/profile',
  authMiddleware({ bearerOnly: authBearerEnabled }),
  authLimiter as unknown as RequestHandler,
  ...(validateDto(UpdateProfileDto) as RequestHandler[]),
  asyncHandler(authCtrl.updateProfile),
);

export default router;
