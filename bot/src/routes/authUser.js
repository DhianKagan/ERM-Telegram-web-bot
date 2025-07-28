// Роуты регистрации, входа и профиля
// Роут только профиля пользователя
const router = require('express').Router();
const ctrl = require('../controllers/authUser');
const authCtrl = require('../controllers/authController');
const { verifyToken, asyncHandler } = require('../api/middleware');
const validateDto = require('../middleware/validateDto.ts');
const {
  SendCodeDto,
  VerifyCodeDto,
  VerifyInitDto,
  UpdateProfileDto,
} = require('../dto/auth.dto.ts');

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

router.get('/profile', verifyToken, ctrl.profile);
router.patch(
  '/profile',
  verifyToken,
  ...validateDto(UpdateProfileDto),
  asyncHandler(ctrl.updateProfile),
);
module.exports = router;
