// patch_cjs/003-cors-origins.cjs
// Добавляет кастомный CORS с поддержкой множества источников (APP_ORIGINS)

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
  const lines = s.split('\n');
  // вставляем после любых shebang/комментариев/импортов — до первого кода
  let i = 0;
  while (i < lines.length && (/^\s*\/\/|^\s*\/\*|^\s*\*|^\s*import\b|^\s*$/).test(lines[i])) i++;
  lines.splice(i, 0, importLine);
  fs.writeFileSync(fp, lines.join('\n'), 'utf8');
  console.log('✅ injected', importLine, 'into', fp);
  return true;
}

function injectUseBeforeRoutes(fp, useLine) {
  if (!fs.existsSync(fp)) return false;
  let s = fs.readFileSync(fp, 'utf8');
  if (s.includes(useLine.trim())) { console.log('ℹ️  already used cors middleware in', fp); return true; }
  // Пытаемся вставить ранним .use (до роутов)
  // эвристика: после первого создания app = express()
  const appDecl = s.match(/const\s+app\s*=\s*express\(\)/);
  if (appDecl) {
    const idx = s.indexOf(appDecl[0]) + appDecl[0].length;
    const head = s.slice(0, idx);
    const tail = s.slice(idx);
    s = head + '\n' + useLine + '\n' + tail;
  } else {
    // fallback: просто в начало файла после импортов
    const lines = s.split('\n');
    let i = 0;
    while (i < lines.length && (/^\s*import\b|^\s*\/\/|^\s*\/\*/).test(lines[i])) i++;
    lines.splice(i, 0, useLine);
    s = lines.join('\n');
  }
  fs.writeFileSync(fp, s, 'utf8');
  console.log('✅ injected use(corsMiddleware) into', fp);
  return true;
}

// 1) Создаём мидлвар
const corsTs = `// apps/api/src/middleware/cors.ts
import type { Request, Response, NextFunction } from 'express';

function parseOrigins(): string[] {
  const list = (process.env.APP_ORIGINS || process.env.APP_ORIGIN || '')
    .split(/[,\s]+/)
    .map(s => s.trim())
    .filter(Boolean);
  return Array.from(new Set(list));
}

export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const origins = parseOrigins();
  const origin = req.headers.origin as string | undefined;

  res.setHeader('Vary', 'Origin');

  if (origin && (origins.length === 0 || origins.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  // Разрешённые заголовки/методы
  res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] as string || 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', req.headers['access-control-request-method'] as string || 'GET,POST,PUT,PATCH,DELETE,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
}
`;
const corsPath = path.resolve('apps/api/src/middleware/cors.ts');
writeFile(corsPath, corsTs);

// 2) Подключаем в server.ts (или index.ts/main.ts)
const entryCandidates = [
  'apps/api/src/server.ts',
  'apps/api/src/index.ts',
  'apps/api/src/main.ts',
];

let wired = false;
for (const rel of entryCandidates) {
  const fp = path.resolve(rel);
  if (!fs.existsSync(fp)) continue;
  injectImportTop(fp, `import { corsMiddleware } from './middleware/cors';`);
  injectUseBeforeRoutes(fp, `app.use(corsMiddleware);`);
  wired = true;
  break;
}
if (!wired) {
  console.error('⚠️  Не найден entrypoint API. Подключи вручную: import { corsMiddleware } from "./middleware/cors"; app.use(corsMiddleware);');
}

// 3) Подсказка по переменным окружения
const examplePath = path.resolve('apps/api/.env.local.example');
if (fs.existsSync(examplePath)) {
  let ex = fs.readFileSync(examplePath, 'utf8');
  if (!/APP_ORIGINS=/.test(ex)) {
    ex += `\n# Разрешённые Origins через запятую (локалка + прод)\nAPP_ORIGINS=http://localhost:5173,https://agromarket.up.railway.app\n`;
    fs.writeFileSync(examplePath, ex, 'utf8');
    console.log('✅ extended', examplePath, 'with APP_ORIGINS example');
  }
}

console.log('\\n📌 Дальше:');
console.log('1) В apps/api/.env.local установи:');
console.log('   APP_ORIGINS=http://localhost:5173,https://agromarket.up.railway.app');
console.log('2) Перезапусти API: pnpm -r --filter ./apps/api dev');