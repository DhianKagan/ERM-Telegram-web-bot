// Контроллер личного кабинета
const { getUser } = require('../db/queries')

exports.profile = async (req, res) => {
  const user = await getUser(req.user.id)
  if (!user) return res.sendStatus(404)
  res.json(user)
}
