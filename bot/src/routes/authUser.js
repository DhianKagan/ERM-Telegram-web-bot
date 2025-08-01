// Роуты регистрации, входа и профиля
// Роут только профиля пользователя
const router = require('express').Router();
const ext = process.env.NODE_ENV === 'test' ? '.ts' : '.js';
const authCtrl = require('../auth/auth.controller' + ext);
const { verifyToken, asyncHandler } = require('../api/middleware');
const validateDto = require('../middleware/validateDto' + ext);
const {
  SendCodeDto,
  VerifyCodeDto,
  VerifyInitDto,
  UpdateProfileDto,
} = require('../dto/auth.dto' + ext);

router.post(
  '/send_code',
  ...validateDto(SendCodeDto),
  asyncHandler(authCtrl.sendCode),
);

router.post(
  '/verify_code',
  ...validateDto(VerifyCodeDto),
  asyncHandler(authCtrl.verifyCode),
);

router.post(
  '/verify_init',
  ...validateDto(VerifyInitDto),
  asyncHandler(authCtrl.verifyInitData),
);

router.get('/profile', verifyToken, authCtrl.profile);
router.patch(
  '/profile',
  verifyToken,
  ...validateDto(UpdateProfileDto),
  asyncHandler(authCtrl.updateProfile),
);
module.exports = router;
