#!/usr/bin/env node
/* cjs patch: 002-cors-allowlist.cjs
 * - Tighten CORS in apps/api/src/api/routes.ts (use CORS_ORIGINS allowlist)
 * - Ensure import cors from 'cors'
 * - Ensure allowedHeaders include X-XSRF-TOKEN
 * - Add/patch apps/api/.env.local.example with CORS_ORIGINS
 * - Add .gitattributes to normalize line endings (avoid CRLF warnings)
 * Safe: writes backups with timestamp.
 */

const fs = require('fs');
const path = require('path');

const now = new Date();
const ts =
  String(now.getFullYear()) +
  String(now.getMonth() + 1).padStart(2, '0') +
  String(now.getDate()).padStart(2, '0') +
  String(now.getHours()).padStart(2, '0') +
  String(now.getMinutes()).padStart(2, '0');

const ensureDir = (p) => {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
};
const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);
const backup = (p) => {
  const b = p + `.bak-${ts}`;
  fs.copyFileSync(p, b);
  return b;
};
const write = (p, s) => {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, s, 'utf8');
};

const apiRoutes = 'apps/api/src/api/routes.ts';
const envExample = 'apps/api/.env.local.example';
const gitattributes = '.gitattributes';

let report = [];

(function patchCors() {
  const src = read(apiRoutes);
  if (!src) {
    report.push(`[SKIP] ${apiRoutes} not found`);
    return;
  }

  const before = src;

  // 1) ensure import cors
  let updated = before;
  if (!/from\s+['"]cors['"]\s*;?/.test(updated)) {
    // вставим после последнего блока import
    const importIdx = updated.lastIndexOf('import ');
    if (importIdx !== -1) {
      const lineEnd = updated.indexOf('\n', importIdx);
      const insertPos = lineEnd === -1 ? updated.length : lineEnd + 1;
      updated =
        updated.slice(0, insertPos) +
        `import cors from 'cors';\n` +
        updated.slice(insertPos);
    } else {
      updated = `import cors from 'cors';\n` + updated;
    }
  }

  // 2) build allowlist middleware block
  const corsBlock = `// --- CORS allowlist (auto-injected) ---
const __corsOrigins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const __corsOptions = {
  origin: function (origin, cb) {
    if (!origin) return cb(null, true); // allow tools/curl; tighten if needed
    return __corsOrigins.includes(origin) ? cb(null, true) : cb(new Error('CORS: origin not allowed'), false);
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-XSRF-TOKEN'],
  maxAge: 600
};
app.use(cors(__corsOptions));
// --- end CORS allowlist ---`;

  // 3) replace app.use(cors()) if present, else insert block once
  if (/app\.use\s*\(\s*cors\s*\(\s*\)\s*\)\s*;?/m.test(updated)) {
    updated = updated.replace(
      /app\.use\s*\(\s*cors\s*\(\s*\)\s*\)\s*;?/m,
      corsBlock,
    );
  } else if (!/CORS allowlist \(auto-injected\)/.test(updated)) {
    // heuristic: put after first occurrence of "const app" or after imports
    const appIdx = updated.search(/const\s+app\s*=\s*/);
    const insertPos =
      appIdx !== -1
        ? updated.indexOf('\n', appIdx) + 1
        : updated.indexOf('\n') + 1;
    updated =
      updated.slice(0, insertPos) + corsBlock + '\n' + updated.slice(insertPos);
  }

  // 4) ensure 'X-XSRF-TOKEN' in any existing cors allowedHeaders (best-effort)
  updated = updated.replace(
    /(allowedHeaders\s*:\s*\[)([^\]]*)(\])/m,
    (m, a, b, c) => {
      const has = /\bX-XSRF-TOKEN\b/.test(b);
      return has
        ? m
        : `${a}${b ? b.trim().replace(/\s+$/, '') + ', ' : ''}'X-XSRF-TOKEN'${c}`;
    },
  );

  if (updated !== before) {
    const b = backup(apiRoutes);
    write(apiRoutes, updated);
    report.push(`[OK] ${apiRoutes} patched (backup: ${b})`);
  } else {
    report.push(
      `[SKIP] ${apiRoutes} unchanged (patterns not found or already applied)`,
    );
  }
})();

(function ensureEnvExample() {
  let content = read(envExample);
  const line = 'CORS_ORIGINS=http://localhost:5173,http://localhost:3000';
  if (!content) {
    write(
      envExample,
      ['# Example env for API', 'JWT_SECRET=replace_me', line, ''].join('\n'),
    );
    report.push(`[OK] ${envExample} created`);
  } else if (!/^CORS_ORIGINS=/m.test(content)) {
    const b = backup(envExample);
    content += (content.endsWith('\n') ? '' : '\n') + line + '\n';
    write(envExample, content);
    report.push(`[OK] ${envExample} appended (backup: ${b})`);
  } else {
    report.push(`[SKIP] ${envExample} already has CORS_ORIGINS`);
  }
})();

(function ensureGitattributes() {
  const desired = [
    '# Normalize line endings: LF in repo, native on checkout',
    '* text=auto eol=lf',
    '',
    '# Shell scripts executable hint',
    '*.sh text eol=lf',
    '*.ps1 text eol=lf',
    '*.ts text eol=lf',
    '*.tsx text eol=lf',
    '*.js text eol=lf',
    '*.jsx text eol=lf',
    '*.md text eol=lf',
  ].join('\n');

  const cur = read(gitattributes);
  if (!cur) {
    write(gitattributes, desired + '\n');
    report.push(`[OK] ${gitattributes} created`);
  } else if (!cur.includes('eol=lf')) {
    const b = backup(gitattributes);
    write(gitattributes, desired + '\n');
    report.push(`[OK] ${gitattributes} updated (backup: ${b})`);
  } else {
    report.push(`[SKIP] ${gitattributes} seems configured`);
  }
})();

console.log(report.join('\n'));
