// Назначение файла: генерация JWT.
// Основные модули: jsonwebtoken, config
import jwt from 'jsonwebtoken';
import config from '../config.js';

const secretKey: string = config.jwtSecret;

interface Payload {
  id: string | number;
  username: string;
  role: string;
  access: number;
}

export function generateToken(user: Payload): string {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      access: user.access,
    },
    secretKey,
    {
      // токен действует неделю, чтобы вход не требовался каждый час
      expiresIn: '7d',
      algorithm: 'HS256',
    },
  );
}

module.exports = { generateToken };
