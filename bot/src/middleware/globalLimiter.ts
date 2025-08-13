// Назначение: глобальный лимитер запросов
// Основные модули: express-rate-limit
import rateLimit from 'express-rate-limit';

const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

export default globalLimiter;
