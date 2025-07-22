// Контроллер личного кабинета.
// Ранее здесь была авторизация через Telegram Login,
// но теперь доступ осуществляется только по одноразовому коду.
const { getUser, updateUser } = require('../db/queries');
const formatUser = require('../utils/formatUser');

exports.profile = async (req, res) => {
  const user = await getUser(req.user.id);
  if (!user) return res.sendStatus(404);
  res.json(formatUser(user));
};

exports.updateProfile = async (req, res) => {
  const user = await updateUser(req.user.id, {
    name: req.body.name,
    phone: req.body.phone,
    mobNumber: req.body.mobNumber,
  });
  if (!user) return res.sendStatus(404);
  res.json(formatUser(user));
};
