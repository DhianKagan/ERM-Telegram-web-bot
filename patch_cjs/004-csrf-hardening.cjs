#!/usr/bin/env node
/* 004-csrf-hardening.cjs
 * - API: add cookieFlags (dev/prod) and wire into lusca.csrf
 * - WEB: add src/lib/csrf.ts and preload in src/main.tsx
 * Safe: backups with timestamp, idempotent-ish.
 */

const fs = require('fs');
const path = require('path');

const now = new Date();
const ts = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;

const read = p => fs.existsSync(p) ? fs.readFileSync(p,'utf8') : null;
const write = (p,s) => { fs.mkdirSync(path.dirname(p),{recursive:true}); fs.writeFileSync(p,s,'utf8'); };
const backup = p => { const b = `${p}.bak-${ts}`; fs.copyFileSync(p,b); return b; };

const apiRoutes = 'apps/api/src/api/routes.ts';
const webMain   = 'apps/web/src/main.tsx';
const webCsrf   = 'apps/web/src/lib/csrf.ts';

// -------- API patch --------
(function patchApi(){
  const src = read(apiRoutes);
  if (!src) return console.log(`[SKIP] ${apiRoutes} not found`);

  let updated = src;

  // 1) Ensure cookieFlags definition (if missing)
  if (!/const\s+cookieFlags\s*=\s*{/.test(updated)) {
    const def =
`// --- csrf cookie flags (auto-injected) ---
const __isProd = process.env.NODE_ENV === 'production';
export const cookieFlags = {
  sameSite: __isProd ? 'None' : 'Lax',
  secure:   __isProd ? true   : false,
  httpOnly: false
};
// --- end csrf cookie flags ---
`;
    // try to insert after imports
    const firstNL = updated.indexOf('\n');
    const insertPos = firstNL === -1 ? 0 : firstNL + 1;
    updated = updated.slice(0, insertPos) + def + updated.slice(insertPos);
  }

  // 2) Ensure lusca.csrf uses cookie: { options: cookieFlags }
  if (/lusca\.csrf\(\s*{[^}]*cookie\s*:\s*{[^}]*options\s*:\s*cookieFlags/m.test(updated)) {
    // already wired
  } else {
    updated = updated.replace(
      /lusca\.csrf\(\s*{([^}]*)}\s*\)/m,
      (m, inner) => {
        // if cookie block already present, try to augment 'options'
        if (/cookie\s*:\s*{[^}]*}/m.test(inner)) {
          // inject options: cookieFlags if missing
          const injected = inner.replace(/cookie\s*:\s*{([^}]*)}/m, (m2, innerCookie) => {
            return /options\s*:\s*cookieFlags/.test(innerCookie)
              ? m2
              : `cookie: { ${innerCookie.trim()}${innerCookie.trim() ? ', ' : ''}options: cookieFlags }`;
          });
          return `lusca.csrf({${injected}})`;
        }
        // no cookie block — add it
        return `lusca.csrf({ ${inner.trim()}${inner.trim() ? ', ' : ''}cookie: { options: cookieFlags } })`;
      }
    );
  }

  if (updated !== src) {
    const b = backup(apiRoutes);
    write(apiRoutes, updated);
    console.log(`[OK] patched ${apiRoutes} (backup: ${b})`);
  } else {
    console.log(`[SKIP] ${apiRoutes} unchanged (patterns already applied)`);
  }
})();

// -------- WEB helper --------
(function writeWebHelper(){
  if (!read(webCsrf)) {
    const code = [
      `// apps/web/src/lib/csrf.ts`,
      `// Preload CSRF token and helper fetch that sends X-XSRF-TOKEN for mutating requests.`,
      ``,
      `const API_BASE = (import.meta as any).env?.VITE_ROUTING_URL || '';`,
      `let __csrfToken: string | null = null;`,
      ``,
      `export async function preloadCsrf(): Promise<void> {`,
      `  try {`,
      `    const res = await fetch(\`\${API_BASE}/api/v1/csrf\`, {`,
      `      method: 'GET',`,
      `      credentials: 'include'`,
      `    });`,
      `    // токен может прийти как тело/заголовок; сервер lusca добавляет req.csrfToken()`,
      `    // здесь пытаемся достать из JSON { token } либо из заголовков 'x-csrf-token'`,
      `    let token: string | null = null;`,
      `    try {`,
      `      const ct = res.headers.get('content-type') || '';`,
      `      if (ct.includes('application/json')) {`,
      `        const j = await res.json();`,
      `        token = j?.token || j?.csrf || null;`,
      `      }`,
      `    } catch { /* ignore */ }`,
      `    if (!token) token = res.headers.get('x-csrf-token');`,
      `    if (token) __csrfToken = token;`,
      `  } catch { /* offline/dev noop */ }`,
      `}`,
      ``,
      `export async function csrfFetch(input: RequestInfo, init: RequestInit = {}): Promise<Response> {`,
      `  const url = typeof input === 'string' ? input : (input as Request).url;`,
      `  const method = (init.method || 'GET').toUpperCase();`,
      `  const shouldAttach = ['POST','PUT','PATCH','DELETE'].includes(method);`,
      `  const headers = new Headers(init.headers || {});`,
      `  if (shouldAttach && __csrfToken) headers.set('X-XSRF-TOKEN', __csrfToken);`,
      `  return fetch(url, { ...init, headers, credentials: init.credentials || 'include' });`,
      `}`,
      ``,
    ].join('\n');
    write(webCsrf, code);
    console.log(`[OK] created ${webCsrf}`);
  } else {
    console.log(`[SKIP] ${webCsrf} exists`);
  }
})();

// -------- wire preload into main.tsx --------
(function wireMain(){
  const src = read(webMain);
  if (!src) return console.log(`[SKIP] ${webMain} not found`);
  if (/preloadCsrf\(\)/.test(src)) return console.log(`[SKIP] ${webMain} already preloads csrf`);
  let updated = src;

  // add import
  if (!/from\s+['"].\/lib\/csrf['"]/.test(updated)) {
    updated = `import { preloadCsrf } from './lib/csrf';\n` + updated;
  }
  // add call near top-level
  const firstNL = updated.indexOf('\n');
  const insertPos = firstNL === -1 ? 0 : firstNL + 1;
  updated = updated.slice(0, insertPos) + `preloadCsrf();\n` + updated.slice(insertPos);

  const b = backup(webMain);
  write(webMain, updated);
  console.log(`[OK] patched ${webMain} (backup: ${b})`);
})();
