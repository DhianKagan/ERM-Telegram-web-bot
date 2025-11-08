// patch_cjs/004-fix-cors-insertion.cjs
const fs = require('fs');
const path = require('path');

const fp = path.resolve('apps/api/src/server.ts');
if (!fs.existsSync(fp)) {
  console.error('❌ not found:', fp);
  process.exit(1);
}

let s = fs.readFileSync(fp, 'utf8');

// 1) гарантируем импорт
if (!s.includes(`import { corsMiddleware } from './middleware/cors';`)) {
  // вставим после первых импортов
  const lines = s.split('\n');
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*import\b/.test(lines[i])) lastImport = i;
  }
  const importLine = `import { corsMiddleware } from './middleware/cors';`;
  if (lastImport >= 0) lines.splice(lastImport + 1, 0, importLine);
  else lines.unshift(importLine);
  s = lines.join('\n');
}

// 2) удаляем все прежние неудачные вставки
s = s.replace(/^\s*app\.use\(corsMiddleware\);\s*$/gm, '');

// 3) найдём объявление app = express(...) и вставим строку после него
const appDecl = s.match(/const\s+app\s*=\s*express\([^)]*\)\s*;?/);
if (!appDecl) {
  console.error('❌ не найдено объявление "const app = express(...)" в server.ts');
  process.exit(1);
}
const idx = s.indexOf(appDecl[0]) + appDecl[0].length;
s = s.slice(0, idx) + `\napp.use(corsMiddleware);` + s.slice(idx);

// 4) записываем
fs.writeFileSync(fp, s, 'utf8');
console.log('✅ fixed insertion in', fp);