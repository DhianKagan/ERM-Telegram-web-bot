#!/usr/bin/env node
// patch: 041-fix-vscode-bootstrap.cjs
// purpose: заменить вызов отсутствующего pretest:e2e в bootstrap и гайде VS Code на явную диагностику Playwright
const fs = require('fs');
const path = require('path');

const replaceInFile = (targetPath, replacer) => {
  const absolutePath = path.resolve(targetPath);
  const content = fs.readFileSync(absolutePath, 'utf8');
  const nextContent = replacer(content).replace(/\r\n/g, '\n');

  if (nextContent === content) {
    throw new Error(`Файл ${targetPath} не был изменён`);
  }

  fs.writeFileSync(absolutePath, nextContent, 'utf8');
  console.log(`updated ${path.relative(process.cwd(), absolutePath)}`);
};

replaceInFile('docs/vscode_local_setup.md', (content) =>
  content
    .replace(
      'pnpm pretest:e2e        # проверка playwright doctor и установка браузеров, если их нет',
      'pnpm dlx playwright doctor || pnpm dlx playwright install --list  # диагностика Playwright и проверка браузеров'
    )
    .replace(
      '- Playwright не находит браузер — повторите `pnpm pretest:e2e` или `pnpm dlx playwright install --with-deps chromium firefox`.',
      '- Playwright не находит браузер — повторите `pnpm dlx playwright doctor || pnpm dlx playwright install --list` или `pnpm dlx playwright install --with-deps chromium firefox`.'
    )
);

replaceInFile('scripts/vscode_bootstrap.sh', (content) =>
  content.replace('pnpm pretest:e2e', 'pnpm dlx playwright doctor || pnpm dlx playwright install --list')
);
