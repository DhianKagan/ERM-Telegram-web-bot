// patch_cjs/002-dotenv-api.cjs
// Подключает dotenv к API и создаёт пример .env.local

const fs = require('fs');
const path = require('path');

function writeFile(fp, content) {
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, content, 'utf8');
  console.log('✅ wrote', fp);
}

function injectImportTop(fp, importLine) {
  if (!fs.existsSync(fp)) return false;
  let s = fs.readFileSync(fp, 'utf8');
  if (s.includes(importLine)) { console.log('ℹ️  already imported in', fp); return true; }
  // Вставляем до первой строки не-комментария
  const lines = s.split('\n');
  let i = 0;
  while (i < lines.length && /^\s*\/\//.test(lines[i])) i++;
  lines.splice(i, 0, importLine);
  fs.writeFileSync(fp, lines.join('\n'), 'utf8');
  console.log('✅ injected', importLine, 'into', fp);
  return true;
}

// 1) loadEnv.ts — аккуратная загрузка .env*.local и .env*
const loadEnvTs = `import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';

// Загружаем из нескольких возможных мест, не перезаписывая уже заданные переменные
const candidates = [
  path.resolve(process.cwd(), 'apps/api/.env.local'),
  path.resolve(process.cwd(), 'apps/api/.env'),
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(process.cwd(), '.env'),
];

for (const p of candidates) {
  if (fs.existsSync(p)) {
    config({ path: p, override: false });
  }
}
`;

const loadEnvPath = path.resolve('apps/api/src/loadEnv.ts');
writeFile(loadEnvPath, loadEnvTs);

// 2) .env.local.example — заполняй по месту
const example = `# apps/api/.env.local — локальные секреты (не коммитить)
# Telegram
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
# JWT/Session
JWT_SECRET=changeme-supersecret
# Database (пример для Mongo / PostgreSQL — оставь нужное)
MONGODB_URI=mongodb://localhost:27017/erm
DATABASE_URL=postgres://user:pass@localhost:5432/erm
# CORS/Origin
APP_ORIGIN=http://localhost:5173
# Map (если backend что-то берёт из env)
PROTOMAPS_API_KEY=e2ee205f93bfd080
`;
const envExamplePath = path.resolve('apps/api/.env.local.example');
writeFile(envExamplePath, example);

// 3) подключим loadEnv.ts в точку входа API
// попробуем несколько популярных entrypoints
const entryCandidates = [
  'apps/api/src/index.ts',
  'apps/api/src/server.ts',
  'apps/api/src/main.ts',
];

let injected = false;
for (const rel of entryCandidates) {
  const fp = path.resolve(rel);
  if (fs.existsSync(fp)) {
    injectImportTop(fp, `import './loadEnv';`);
    injected = true;
    break;
  }
}
if (!injected) {
  console.error('⚠️  Не найден entrypoint API (index.ts/server.ts/main.ts). Добавь вручную: import "./loadEnv";');
}

console.log('\n📌 Дальше:');
console.log('1) Скопируй пример:  cp apps/api/.env.local.example apps/api/.env.local');
console.log('2) Заполни секреты в apps/api/.env.local');
console.log('3) Стартуй API:    pnpm -r --filter ./apps/api dev   # или run start');