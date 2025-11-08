// patch_cjs/005-smart-cors-insertion.cjs
// Ищет переменную, которой присваивается express(...), и вставляет X.use(corsMiddleware) корректно.

const fs = require('fs');
const path = require('path');

const fp = path.resolve('apps/api/src/server.ts');
if (!fs.existsSync(fp)) {
  console.error('❌ not found:', fp);
  process.exit(1);
}

let s = fs.readFileSync(fp, 'utf8');

// 0) гарантируем импорт corsMiddleware
if (!s.includes(`import { corsMiddleware } from './middleware/cors';`)) {
  const lines = s.split('\n');
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) if (/^\s*import\b/.test(lines[i])) lastImport = i;
  const importLine = `import { corsMiddleware } from './middleware/cors';`;
  if (lastImport >= 0) lines.splice(lastImport + 1, 0, importLine);
  else lines.unshift(importLine);
  s = lines.join('\n');
}

// 1) уберём любые старые вставки *.use(corsMiddleware);
s = s.replace(/^\s*[a-zA-Z_$][\w$]*\.use\(\s*corsMiddleware\s*\)\s*;?\s*$/gm, '');

// 2) найдём имя переменной, которой присваивают express(...)
const re = /(const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*express\s*\(/;
const m = s.match(re);
if (!m) {
  console.error('❌ В server.ts не найдено присваивание express(...). Покажи первые ~50 строк файла — подстрою патч.');
  process.exit(1);
}
const varName = m[2];

// 3) вставим X.use(corsMiddleware) сразу после строки объявления
const declIndex = s.indexOf(m[0]);
const endOfLine = s.indexOf('\n', declIndex);
const insertPos = endOfLine === -1 ? s.length : endOfLine;
s = s.slice(0, insertPos) + `\n${varName}.use(corsMiddleware);` + s.slice(insertPos);

// 4) записываем
fs.writeFileSync(fp, s, 'utf8');
console.log(`✅ inserted ${varName}.use(corsMiddleware) into`, fp);