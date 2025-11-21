#!/usr/bin/env node
// patch: 040-vscode-local-setup.cjs
// purpose: добавить гайд по настройке VS Code и бутстрап-скрипт для локальной сборки и e2e
const fs = require('fs');
const path = require('path');

const writeFile = (targetPath, content) => {
  const normalized = content.replace(/\r\n/g, '\n');
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, normalized, 'utf8');
  console.log(`updated ${path.relative(process.cwd(), targetPath)}`);
};

const ensureExecutable = (targetPath) => {
  const currentMode = fs.statSync(targetPath).mode;
  const executableMode = currentMode | 0o755;
  fs.chmodSync(targetPath, executableMode);
};

const updateReadme = () => {
  const readmePath = path.resolve('README.md');
  const readme = fs.readFileSync(readmePath, 'utf8');
  const snippet = [
    '```bash',
    'pnpm install',
    './scripts/create_env_from_exports.sh',
    './scripts/setup_and_test.sh',
    'pnpm run dev # запуск api и web без таймаута PNPM',
    './scripts/start_api_with_memdb.sh # только api с MongoDB в памяти',
    '```',
  ].join('\n');

  if (readme.includes('docs/vscode_local_setup.md')) {
    return;
  }

  if (!readme.includes(snippet)) {
    throw new Error('Не найден блок быстрого старта для вставки ссылки на VS Code гайд.');
  }

  const updated = readme.replace(
    snippet,
    `${snippet}\n\n- Подробная настройка локального окружения VS Code: [docs/vscode_local_setup.md](docs/vscode_local_setup.md)`
  );

  fs.writeFileSync(readmePath, updated, 'utf8');
  console.log('updated README.md');
};

const vscodeGuide = [
  '# Настройка VS Code для локальной разработки и тестов',
  '',
  'Назначение: шаги для подготовки окружения на локальной машине (VS Code или любой терминал) с упором на сборку, e2e и Lighthouse.',
  '',
  '## Требования',
  '',
  '- Node.js 20+ и включённый corepack (`corepack enable`).',
  '- pnpm 10 (устанавливается corepack\'ом автоматически).',
  '- Git и bash (для Windows удобнее WSL2/Ubuntu).',
  '- Свободные 6–8 ГБ диска для Chromium/Firefox Playwright.',
  '',
  '## Быстрая подготовка в терминале VS Code',
  '',
  'Откройте репозиторий в VS Code и выполните в встроенном терминале:',
  '',
  '```bash',
  'corepack enable',
  'pnpm install --frozen-lockfile || pnpm install',
  './scripts/create_env_from_exports.sh # создаёт .env, если его нет',
  'pnpm dlx playwright install --with-deps chromium firefox',
  'pnpm --filter web run build:dist',
  'pnpm pretest:e2e        # проверка playwright doctor и установка браузеров, если их нет',
  '```',
  '',
  'Если на Linux не стоят системные библиотеки для браузеров, запустите `pnpm dlx playwright install-deps chromium firefox`.',
  '',
  '## Запуск e2e из VS Code',
  '',
  '1. Запустите API с in-memory MongoDB: `./scripts/start_api_with_memdb.sh`.',
  '2. Во втором терминале выполните `pnpm test:e2e` (используются конфиги из `tests/e2e`).',
  '3. Для отдельных сценариев укажите проект браузера: `pnpm test:e2e -- --project=chromium --grep="контраст"`.',
  '',
  '## Запуск Lighthouse локально',
  '',
  '```bash',
  'pnpm --dir apps/web build',
  'pnpm dlx lhci autorun --upload.target=filesystem',
  '```',
  '',
  'Токен `LHCI_GITHUB_APP_TOKEN` не требуется для локального прогона; отчёт будет сохранён в каталоге `.lighthouseci`.',
  '',
  '## Распространённые проблемы',
  '',
  '- «command not found pnpm» — выполните `corepack enable` и перезапустите терминал.',
  '- Ошибки сборки `sharp`/`esbuild` — запустите `pnpm rebuild` в корне.',
  '- Playwright не находит браузер — повторите `pnpm pretest:e2e` или `pnpm dlx playwright install --with-deps chromium firefox`.',
  '- Нет доступа к порту 5173/3000 — завершите старые процессы (`lsof -i :3000`) или смените порт через переменную `PORT`.',
  '',
].join('\n');

writeFile(path.resolve('docs/vscode_local_setup.md'), vscodeGuide);

const vscodeBootstrap = [
  '#!/usr/bin/env bash',
  '# Назначение: подготовка локальной разработки в VS Code (зависимости, .env, Playwright, сборка).',
  '# Модули: bash, pnpm, playwright.',
  'set -euo pipefail',
  '',
  'cd "$(dirname "$0")/.."',
  '',
  'corepack enable || true',
  '',
  'if [ ! -f .env ]; then',
  '  ./scripts/create_env_from_exports.sh',
  'fi',
  '',
  'pnpm install --frozen-lockfile || pnpm install',
  '',
  'if command -v pnpm >/dev/null; then',
  '  pnpm dlx playwright install --with-deps chromium firefox',
  '  if [ "${OSTYPE:-}" = "linux-gnu" ] || [ "${OSTYPE:-}" = "linux" ]; then',
  '    pnpm dlx playwright install-deps chromium firefox || true',
  '  fi',
  'fi',
  '',
  'pnpm --filter web run build:dist',
  'pnpm pretest:e2e',
  '',
  'echo "VS Code окружение готово: зависимости установлены, браузеры Playwright добавлены, сборка web выполнена."',
  '',
].join('\n');

writeFile(path.resolve('scripts/vscode_bootstrap.sh'), vscodeBootstrap);

ensureExecutable(path.resolve('scripts/vscode_bootstrap.sh'));
updateReadme();
