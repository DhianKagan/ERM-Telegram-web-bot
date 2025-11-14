#!/usr/bin/env node
// patch: 030-extend-express-request.cjs
// purpose: добавить в тип Request поля user и task для user-aware middleware
const fs = require('fs');
const path = require('path');

const targetPath = path.resolve('apps/api/src/types/express.d.ts');

const content = `// Назначение файла: расширение интерфейса Request методом csrfToken и пользовательскими данными
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
`;

fs.writeFileSync(targetPath, content, 'utf8');
console.log('updated ' + path.relative(process.cwd(), targetPath));
