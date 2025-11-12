#!/usr/bin/env node
/* cjs patch: 001-repo-map-and-snapshot.cjs (fixed)
 * Creates/updates:
 *  - docs/REPO_MAP.md
 *  - scripts/repo-snapshot.sh
 *  - scripts/repo-snapshot.ps1
 * Optionally appends links to AGENTS.md
 */

const fs = require('fs');
const path = require('path');

const now = new Date();
const ts = new Intl.DateTimeFormat('uk-UA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})
  .format(now)
  .replace(/\D+/g, '')
  .slice(0, 12); // yyyymmddhhmm

const ensureDir = (p) => {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
};
const writeOrBackup = (targetPath, content) => {
  ensureDir(path.dirname(targetPath));
  if (!fs.existsSync(targetPath)) {
    fs.writeFileSync(targetPath, content, 'utf8');
    return { action: 'created', targetPath };
  }
  const backup = `${targetPath}.bak-${ts}`;
  fs.copyFileSync(targetPath, backup);
  fs.writeFileSync(targetPath, content, 'utf8');
  return { action: 'updated_with_backup', targetPath, backup };
};
const appendIfMissing = (targetPath, markerTitle, block) => {
  if (!fs.existsSync(targetPath)) return false;
  const data = fs.readFileSync(targetPath, 'utf8');
  if (data.includes(markerTitle)) return false;
  const backup = `${targetPath}.bak-${ts}`;
  fs.writeFileSync(backup, data, 'utf8');
  fs.writeFileSync(
    targetPath,
    data.trimEnd() + '\n\n' + block.trimStart() + '\n',
    'utf8',
  );
  return true;
};

// -------- contents (без template literals) --------
const REPO_MAP = [
  '# Repo Map (шпаргалка)',
  '',
  `Обновлено: ${now.toISOString()}`,
  '',
  '## Корень / CI / Инфра',
  '- Workflows: `.github/workflows/ci.yml, codeql.yml, codex-quality.yml, danger.yml, docker.yml, lighthouse.yml, refresh-addresses.yml, release.yml`',
  '- Env-шаблоны: `./.env.example`, `./Railway/.env`',
  '- Патчи: `patch_cjs/*`',
  '- Semgrep: `./semgrep/`',
  '- Prometheus: `./prometheus/`',
  '- Railway: `./Railway/{analysis,config,logs}`',
  '',
  '## Backend (apps/api)',
  '- Точки мидлвар/роутинга/аутентификации:',
  '  - JWT/логгер/заголовки — `apps/api/src/api/middleware.ts`',
  '  - Роуты/CORS/CSRF — `apps/api/src/api/routes.ts`',
  '  - Ошибки/метрики — `apps/api/src/middleware/errorMiddleware.ts`',
  '  - Auth/guards — `apps/api/src/auth/*`, `roles.guard.ts`, `tmaAuth.guard.ts`',
  '- Конфигурация:',
  '  - JWT_SECRET — `apps/api/src/config.ts`',
  '  - Примеры env — `apps/api/.env.local`, `.env.local.example`',
  '- Бот/TMA:',
  '  - `apps/api/src/bot/bot.ts`, `apps/api/src/bot/runtime.ts`',
  '',
  '## Frontend (apps/web)',
  '- Сборка/вход: `apps/web/vite.config.ts`, `apps/web/src/main.tsx`, `apps/web/index.html`',
  '- Env: `apps/web/.env`, `.env.example`',
  '',
  '## Shared / Scripts / Tests',
  '- Shared: `packages/shared/`',
  '- Scripts: `scripts/ci/*`, `scripts/db/*`, `scripts/railway/*`, `scripts/run_security_lint.sh`',
  '- Tests: `tests/api`, `tests/e2e`, `tests/playwright`, `tests/fixtures`, `tests/stubs`, `tests/railway`',
  '',
  '---',
  '',
  '## Горячие точки (JWT / CSRF / CORS / TMA)',
  '**JWT** — секрет в env, верификация в `apps/api/src/api/middleware.ts`.',
  '',
  '**CSRF** — `lusca.csrf({ angular: true, cookie: { ... } })` в `routes.ts`. Endpoints-исключения: `/api/v1/csrf`, префикс `/api/tma`. Метрики ошибок в `errorMiddleware.ts`.',
  '',
  '**CORS** — заменить глобальное `app.use(cors())` на allowlist + `credentials:true` + заголовки `X-XSRF-TOKEN`/Authorization.',
  '',
  '**TMA/Telegram** — guards в `apps/api/src/auth/tmaAuth.guard.ts`, логика бота в `apps/api/src/bot/*.ts`.',
  '',
  '---',
  '',
  '## Снапшоты (быстрый старт)',
  '- Bash: `scripts/repo-snapshot.sh` → создаёт `repo_snapshot-YYYYMMDD-HHMM.txt` в корне.',
  '- PowerShell: `scripts/repo-snapshot.ps1` → то же самое.',
  '',
  '> Рекомендовано хранить последние 3–5 снапшотов и сжимать старые: `gzip -9 repo_snapshot-*.txt`.',
].join('\n');

const SNAPSHOT_SH = [
  '#!/usr/bin/env bash',
  'set -euo pipefail',
  '',
  'ts="$(date +%Y%m%d-%H%M)"',
  'out="repo_snapshot-$ts.txt"',
  '',
  '{',
  '  echo "=== REPO SNAPSHOT @ $ts ==="',
  '  echo',
  '  echo "## git root"',
  '  git rev-parse --show-toplevel || true',
  '  echo',
  '',
  '  echo "## tree (maxdepth=2)"',
  '  find . -maxdepth 2 -type d | sort',
  '  echo',
  '',
  '  echo "## CI workflows"',
  '  find .github/workflows -maxdepth 1 -type f 2>/dev/null || true',
  '  echo',
  '',
  '  echo "## package.json (все)"',
  '  find . -name "package.json" 2>/dev/null',
  '  echo',
  '',
  '  echo "## env-файлы"',
  '  find . -name ".env*" 2>/dev/null',
  '  echo',
  '',
  '  echo "## точки входа API и мидлвары"',
  '  find apps/api -maxdepth 3 -type f \\( -iname "*main.*" -o -iname "*index.*" -o -iname "*middleware*" -o -iname "*guard*" -o -iname "*auth*" \\) 2>/dev/null || true',
  '  echo',
  '',
  '  echo "## точки входа WEB"',
  '  find apps/web -maxdepth 3 -type f \\( -iname "next.config.*" -o -iname "vite.config.*" -o -iname "*main.*" -o -iname "*index.*" \\) 2>/dev/null || true',
  '  echo',
  '',
  '  echo "## поиск ключевых слов (JWT/CSRF/Telegram/CORS) — первые 200 совпадений"',
  '  echo "# JWT:"',
  '  grep -RIn --exclude-dir=node_modules --exclude-dir=.git -E "JWT|jsonwebtoken|jwt" apps 2>/dev/null | head -n 200 || true',
  '  echo',
  '  echo "# CSRF:"',
  '  grep -RIn --exclude-dir=node_modules --exclude-dir=.git -E "csrf|CSRF" apps 2>/dev/null | head -n 200 || true',
  '  echo',
  '  echo "# Telegram:"',
  '  grep -RIn --exclude-dir=node_modules --exclude-dir=.git -E "Telegram|telegraf|aiogram" apps 2>/dev/null | head -n 200 || true',
  '  echo',
  '  echo "# CORS:"',
  '  grep -RIn --exclude-dir=node_modules --exclude-dir=.git -E "CORS|cors" apps 2>/dev/null | head -n 200 || true',
  '  echo',
  '',
  '  echo "## тесты"',
  '  find tests -maxdepth 2 -type d 2>/dev/null || true',
  '  echo',
  '',
  '  echo "## scripts"',
  '  find scripts -maxdepth 2 -type f 2>/dev/null || true',
  '  echo',
  '',
  '  echo "## важные файлы (первые 120 строк)"',
  '  for f in AGENTS.md CHANGELOG.md CONTRIBUTING.md ROADMAP.md Dockerfile; do',
  '    if [ -f "$f" ]; then',
  '      echo "--- $f ---"',
  '      sed -n \'1,120p\' "$f"',
  '      echo',
  '    fi',
  '  done',
  `} > "$out" 2>&1`,
  '',
  'echo "Снимок записан в $out"',
].join('\n');

const SNAPSHOT_PS1 = [
  'Param(',
  '  [string]$OutFile',
  ')',
  '$ts  = Get-Date -Format "yyyyMMdd-HHmm"',
  '$out = If ($OutFile) { $OutFile } Else { "repo_snapshot-$ts.txt" }',
  '',
  '"=== REPO SNAPSHOT @ $ts ===`n" | Out-File $out -Encoding UTF8',
  '',
  '"## git root" | Out-File $out -Encoding UTF8 -Append',
  '(git rev-parse --show-toplevel) *>> $out',
  '"`n## tree (depth=2)" | Out-File $out -Append',
  '(Get-ChildItem -Depth 2 -Directory | Sort-Object FullName | ForEach-Object {$_.FullName}) *>> $out',
  '',
  '"`n## CI workflows" | Out-File $out -Append',
  '(Get-ChildItem .\\.github\\workflows -File -ErrorAction SilentlyContinue | Select-Object FullName) *>> $out',
  '',
  '"`n## package.json (все)" | Out-File $out -Append',
  '(Get-ChildItem -Recurse -Filter package.json -ErrorAction SilentlyContinue | Select-Object FullName) *>> $out',
  '',
  '"`n## env-файлы" | Out-File $out -Append',
  '(Get-ChildItem -Recurse -Filter ".env*" -ErrorAction SilentlyContinue | Select-Object FullName) *>> $out',
  '',
  '"`n## точки входа API и мидлвары" | Out-File $out -Append',
  '(Get-ChildItem .\\apps\\api -Recurse -File -Include *main.*,*index.*,*middleware*,*guard*,*auth* -ErrorAction SilentlyContinue | Select-Object FullName) *>> $out',
  '',
  '"`n## точки входа WEB" | Out-File $out -Append',
  '(Get-ChildItem .\\apps\\web -Recurse -File -Include next.config.*,vite.config.*,main.*,index.* -ErrorAction SilentlyContinue | Select-Object FullName) *>> $out',
  '',
  '"`n## поиск JWT/CSRF/Telegram/CORS (первые 200 совпадений)" | Out-File $out -Append',
  '"`n# JWT:" | Out-File $out -Append',
  '(Select-String -Path .\\apps\\* -Pattern "JWT|jsonwebtoken|jwt" -SimpleMatch:$false -ErrorAction SilentlyContinue | Select-Object -First 200) *>> $out',
  '"`n# CSRF:" | Out-File $out -Append',
  '(Select-String -Path .\\apps\\* -Pattern "csrf|CSRF" -SimpleMatch:$false -ErrorAction SilentlyContinue | Select-Object -First 200) *>> $out',
  '"`n# Telegram:" | Out-File $out -Append',
  '(Select-String -Path .\\apps\\* -Pattern "Telegram|telegraf|aiogram" -SimpleMatch:$false -ErrorAction SilentlyContinue | Select-Object -First 200) *>> $out',
  '"`n# CORS:" | Out-File $out -Append',
  '(Select-String -Path .\\apps\\* -Pattern "CORS|cors" -SimpleMatch:$false -ErrorAction SilentlyContinue | Select-Object -First 200) *>> $out',
  '',
  '"`n## тесты" | Out-File $out -Append',
  '(Get-ChildItem .\\tests -Depth 2 -Directory -ErrorAction SilentlyContinue | Select-Object FullName) *>> $out',
  '',
  '"`n## scripts" | Out-File $out -Append',
  '(Get-ChildItem .\\scripts -Depth 2 -File -ErrorAction SilentlyContinue | Select-Object FullName) *>> $out',
  '',
  '"`n## важные файлы (первые 120 строк)" | Out-File $out -Append',
  '$files = @("AGENTS.md","CHANGELOG.md","CONTRIBUTING.md","ROADMAP.md","Dockerfile")',
  'foreach ($f in $files) {',
  '  if (Test-Path $f) {',
  '    "`n--- $f ---" | Out-File $out -Append',
  '    (Get-Content $f -TotalCount 120) *>> $out',
  '  }',
  '}',
  '"Снимок записан в $out"',
].join('\n');

// -------- write files --------
const mapRes = writeOrBackup('docs/REPO_MAP.md', REPO_MAP);
const shRes = writeOrBackup('scripts/repo-snapshot.sh', SNAPSHOT_SH);
try {
  if (process.platform !== 'win32')
    fs.chmodSync('scripts/repo-snapshot.sh', 0o755);
} catch {}
const psRes = writeOrBackup('scripts/repo-snapshot.ps1', SNAPSHOT_PS1);

// Optional: link block in AGENTS.md
const AGENTS_BLOCK_TITLE = '## Repo Map & Snapshots';
const AGENTS_BLOCK = [
  '## Repo Map & Snapshots',
  '- Шпаргалка: [docs/REPO_MAP.md](docs/REPO_MAP.md)',
  '- Снимки репозитория:',
  '  - Bash: `./scripts/repo-snapshot.sh`',
  '  - PowerShell: `./scripts/repo-snapshot.ps1`',
  '- Артефакты пишутся в корень как `repo_snapshot-YYYYMMDD-HHMM.txt`.',
].join('\n');
const addedToAgents = appendIfMissing(
  'AGENTS.md',
  AGENTS_BLOCK_TITLE,
  AGENTS_BLOCK,
);

// Report
const lines = [];
lines.push(`[docs/REPO_MAP.md] ${mapRes.action}`);
lines.push(`[scripts/repo-snapshot.sh] ${shRes.action}`);
lines.push(`[scripts/repo-snapshot.ps1] ${psRes.action}`);
lines.push(
  `[AGENTS.md] ${addedToAgents ? 'appended' : 'skipped (not found or section exists)'}`,
);
console.log(lines.join('\n'));
