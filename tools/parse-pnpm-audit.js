// tools/parse-pnpm-audit.js
// Usage: node tools/parse-pnpm-audit.js pnpm-audit.json
const fs = require('fs');
const path = require('path');

const p = process.argv[2] || 'pnpm-audit.json';
if (!fs.existsSync(p)) {
  console.error('File not found:', p);
  process.exit(2);
}
let raw;
try {
  raw = JSON.parse(fs.readFileSync(p, 'utf8'));
} catch (e) {
  console.error('Invalid JSON:', e.message);
  process.exit(2);
}

function printLine() {
  console.log('-'.repeat(100));
}

function handleAdvisories(obj) {
  const items = Object.values(obj);
  items.forEach(a => {
    const pkg = a.module_name || a.package || a.name || 'unknown';
    const severity = (a.severity || 'unknown').toUpperCase();
    const vulnerable = a.vulnerable_versions || a.vulnerable || '-';
    const patched = a.patched_versions || a.patched || 'none';
    const url = a.url || a.advisory || a.findings?.[0]?.url || '-';
    const paths = (a.findings && a.findings.map(f => f.paths).flat()) || a.paths || [];
    console.log(`${severity.padEnd(9)} | ${pkg.padEnd(30)} | vuln: ${vulnerable.padEnd(18)} | patched: ${patched.padEnd(12)}`);
    if (paths.length) {
      console.log(`  paths: ${Array.from(new Set(paths)).join(', ')}`);
    }
    if (url) console.log(`  more: ${url}`);
    // Suggestion
    if (patched && patched !== 'none' && patched !== '0') {
      console.log(`  suggested: pnpm -w add ${pkg}@^${patched.replace(/[^0-9.\-^]/g,'')}`);
    } else {
      console.log(`  suggested: проверить upstream (не найдено patched_versions)`);
    }
    printLine();
  });
}

// try multiple shapes
if (raw.advisories && Object.keys(raw.advisories).length) {
  console.log('Found advisories:');
  printLine();
  handleAdvisories(raw.advisories);
  process.exit(0);
}

if (raw.vulnerabilities && Object.keys(raw.vulnerabilities).length) {
  console.log('Found vulnerabilities:');
  printLine();
  const entries = Object.entries(raw.vulnerabilities);
  entries.forEach(([pkg, info]) => {
    const severity = (info.severity || 'unknown').toUpperCase();
    const patched = info.patched_versions || info.fixAvailable?.version || 'unknown';
    console.log(`${severity.padEnd(9)} | ${pkg.padEnd(30)} | patched: ${String(patched).padEnd(12)}`);
    if (info.nodes) console.log(`  nodes: ${info.nodes.join(', ')}`);
    if (info.findings && info.findings.length) {
      info.findings.forEach(f => {
        if (f.version) console.log(`  affected version: ${f.version}`);
        if (f.path) console.log(`  path: ${f.path}`);
      });
    }
    if (patched && patched !== 'unknown') {
      console.log(`  suggested: pnpm -w add ${pkg}@^${String(patched).replace(/[^0-9.\-^]/g,'')}`);
    } else {
      console.log('  suggested: проверить конкретную транзитивную зависимость или обновить родительский пакет');
    }
    printLine();
  });
  process.exit(0);
}

// fallback: print top-level keys
console.log('Не удалось распознать стандартную структуру audit JSON. Доступные ключи в файле:', Object.keys(raw));
console.log('Распечатка краткого содержимого первых 3 ключей:');
printLine();
Object.keys(raw).slice(0,3).forEach(k => {
  console.log(k, JSON.stringify(raw[k], null, 2).slice(0,500));
  printLine();
});
process.exit(0);
