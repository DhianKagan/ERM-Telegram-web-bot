// scripts/patch-map-usage.cjs
const fs = require('fs');
const path = require('path');

const SRC_ROOT = path.resolve('apps/web/src');
const LIB_PATH = path.resolve('apps/web/src/mapLibrary.ts');

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (st.isFile() && /\.(ts|tsx|js|jsx)$/.test(name)) out.push(p);
  }
  return out;
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function ensureImport(filePath, content, importSpec, importPath) {
  const has =
    new RegExp(
      `from\\s+['"]${importPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`,
    ).test(content) &&
    new RegExp(`\\{[^}]*\\b${importSpec}\\b[^}]*\\}`).test(content);
  if (has) return content;

  // Вставим импорт сразу после первых импортов
  const rel = toPosix(path.relative(path.dirname(filePath), importPath));
  const specLine = `import { ${importSpec} } from '${rel.startsWith('.') ? rel : './' + rel}';\n`;
  const lines = content.split('\n');
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++)
    if (/^\s*import\b/.test(lines[i])) lastImport = i;
  if (lastImport >= 0) {
    lines.splice(lastImport + 1, 0, specLine);
    return lines.join('\n');
  }
  return specLine + content;
}

function patchFile(fp) {
  let s = fs.readFileSync(fp, 'utf8');
  const original = s;

  // Пропускаем d.ts
  if (fp.endsWith('.d.ts')) return false;

  // Нужны только файлы, где создаётся new maplibregl.Map
  if (!/new\s+maplibregl\.Map\s*\(\s*\{/.test(s)) return false;

  // Заменим конструктор на нашу обёртку
  s = s.replace(/new\s+maplibregl\.Map\s*\(\s*\{/g, 'createMap({');

  // Добавим импорт createMap (с относительным путём)
  s = ensureImport(fp, s, 'createMap', LIB_PATH);

  if (s !== original) {
    fs.writeFileSync(fp, s, 'utf8');
    console.log('✅ patched', path.relative(process.cwd(), fp));
    return true;
  }
  return false;
}

(function main() {
  if (!fs.existsSync(SRC_ROOT)) {
    console.error('❌ Не найден каталог', SRC_ROOT);
    process.exit(1);
  }
  if (!fs.existsSync(LIB_PATH)) {
    console.error(
      '❌ Не найден',
      LIB_PATH,
      '— сначала запусти scripts/patch-protomaps.cjs',
    );
    process.exit(1);
  }

  const files = walk(SRC_ROOT);
  let count = 0;
  for (const f of files) {
    try {
      if (patchFile(f)) count++;
    } catch (e) {
      console.warn('⚠️  ошибка обработки', f, e.message);
    }
  }
  if (count === 0) {
    console.log(
      'ℹ️  Прямых вызовов new maplibregl.Map не найдено — возможно, карта уже инициализируется через createMap.',
    );
  } else {
    console.log(`\n🏁 Готово: изменено файлов: ${count}`);
  }
})();
