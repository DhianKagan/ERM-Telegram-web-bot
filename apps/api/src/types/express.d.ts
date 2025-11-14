// Назначение файла: расширение интерфейса Request методом csrfToken и пользовательскими данными
// Основные модули: express-serve-static-core
import 'express-serve-static-core';
import type { TaskInfo, UserInfo } from './request';

declare module 'express-serve-static-core' {
  interface Request {
    csrfToken(): string;
    user?: UserInfo;
    task?: TaskInfo;
  }
}
