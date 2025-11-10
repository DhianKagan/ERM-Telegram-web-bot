#!/usr/bin/env node
/* cjs patch: 003-env-sync.cjs
 * Purpose: unify env examples (local + production)
 * Safe: creates backups with timestamps.
 */

const fs = require('fs');
const path = require('path');
const now = new Date();
const ts = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;

const read = p => fs.existsSync(p) ? fs.readFileSync(p,'utf8') : null;
const backup = p => { if (!fs.existsSync(p)) return; const b = `${p}.bak-${ts}`; fs.copyFileSync(p,b); return b; };
const write = (p,s) => { fs.mkdirSync(path.dirname(p),{recursive:true}); fs.writeFileSync(p,s,'utf8'); };

const apiLocal = 'apps/api/.env.local.example';
const apiProd  = 'apps/api/.env.production.example';

const PROD_ORIGINS = 'https://agromarket.up.railway.app';
const COOKIE_DOMAIN = '.agromarket.up.railway.app';

// ---------- LOCAL example ----------
(function updateLocal(){
  const before = read(apiLocal) || '';
  let content = before;
  if (!/CORS_ORIGINS=/.test(content))
    content += `\nCORS_ORIGINS=${PROD_ORIGINS},http://localhost:5173\n`;
  else
    content = content.replace(/^CORS_ORIGINS=.*$/m, `CORS_ORIGINS=${PROD_ORIGINS},http://localhost:5173`);
  if (!/COOKIE_DOMAIN=/.test(content))
    content += `\nCOOKIE_DOMAIN=${COOKIE_DOMAIN}\n`;
  else
    content = content.replace(/^COOKIE_DOMAIN=.*$/m, `COOKIE_DOMAIN=${COOKIE_DOMAIN}`);

  if (before !== content){
    const b = backup(apiLocal);
    write(apiLocal, content);
    console.log(`[OK] updated ${apiLocal} (backup: ${b || 'none'})`);
  } else {
    console.log(`[SKIP] ${apiLocal} already up to date`);
  }
})();

// ---------- PRODUCTION example ----------
(function createProd(){
  if (fs.existsSync(apiProd)) {
    console.log(`[SKIP] ${apiProd} exists`);
    return;
  }
  const lines = [
    '# Example production env (Railway/GitHub)',
    `CORS_ORIGINS=${PROD_ORIGINS}`,
    `COOKIE_DOMAIN=${COOKIE_DOMAIN}`,
    'NODE_ENV=production',
    '',
    '# Security',
    'JWT_SECRET=<set in Railway/GitHub>',
    'SESSION_SECRET=<set in Railway/GitHub>',
    '',
    '# Database / API',
    'MONGODB_URI=<your-production-db-uri>',
    'PORT=8080',
    '',
    '# Telegram / Bot',
    'BOT_TOKEN=<telegram-bot-token>',
    'BOT_USERNAME=<bot-username>',
    'APP_URL=https://agromarket.up.railway.app',
    ''
  ];
  write(apiProd, lines.join('\n'));
  console.log(`[OK] created ${apiProd}`);
})();
