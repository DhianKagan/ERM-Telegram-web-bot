// Назначение файла: расширение интерфейса Request методом csrfToken
// Основные модули: express-serve-static-core
import 'express-serve-static-core';

declare module 'express-serve-static-core' {
  interface Request {
    csrfToken(): string;
  }
}
