#!/usr/bin/env node
const fs = require('fs');

function patchMakefile() {
  let mk = fs.readFileSync('Makefile', 'utf8');
  mk = mk.replace(/(\n\s*)git clean -xfd .*?(\r?\n)/, '$1# (ci-safe patch) removed destructive clean$2');
  mk = mk.replace(/ci-local:\s*clean\s*/, 'ci-local: ');
  fs.writeFileSync('Makefile', mk);
  console.log('[OK] Patched Makefile');
}

function patchCiLocalSh() {
  const p = 'scripts/ci-local.sh';
  if (!fs.existsSync(p)) return;
  let s = fs.readFileSync(p, 'utf8');
  s = s.replace(/rm -rf\s+apps\/api\s*\n/g, '');
  fs.writeFileSync(p, s);
  console.log('[OK] Patched ci-local.sh');
}

function patchPackageJson() {
  const p = 'package.json';
  const pkg = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (pkg.scripts?.['test:e2e']?.includes('|| true')) {
    pkg.scripts['test:e2e'] = pkg.scripts['test:e2e'].replace(/\s*\|\|\s*true/, '');
    fs.writeFileSync(p, JSON.stringify(pkg, null, 2));
    console.log('[OK] Patched test:e2e script');
  }
}

patchMakefile();
patchCiLocalSh();
patchPackageJson();
