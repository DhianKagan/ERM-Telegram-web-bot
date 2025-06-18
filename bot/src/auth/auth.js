const  Bot  = require('node-telegram-bot-api');
require('dotenv').config({ path: './config/.env' });
const bot = new Bot(process.env.BOT_TOKEN);


async function verifyAdmin(userId) {
  const admins = await bot.getChatAdministrators(process.env.CHAT_ID);
  return admins.some(admin => admin.user.id === userId);
}
const jwt = require('jsonwebtoken');

const secretKey = process.env.JWT_SECRET || 'your-secret-key';

// Function to generate a JWT token
function generateToken(user) {
  const payload = {
    id: user.id,
    username: user.username,
    isAdmin: user.isAdmin
  };

  return jwt.sign(payload, secretKey, { expiresIn: '1h' });
}



module.exports = { verifyAdmin,generateToken };