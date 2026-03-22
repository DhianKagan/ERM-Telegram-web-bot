#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');

const optionalCanonicalDoc = 'docs/architecture.md';
const optionalCanonicalExists = fs.existsSync(path.join(repoRoot, optionalCanonicalDoc));

const canonicalDocs = [
  {
    path: 'README.md',
    requiredLinks: ['docs/README.md', 'docs/index.md', 'docs/technical_manual.md'],
    requiredStrings: ['/api/v1/maps/expand', 'MAPS_HEADLESS_FALLBACK', 'docs/index.md'],
  },
  {
    path: 'docs/README.md',
    requiredLinks: ['../README.md', 'index.md', 'technical_manual.md'],
    requiredStrings: ['docs/index.md', 'queue_recovery_runbook.md', 'railway_logs.md', 'railway_full_setup.md'],
  },
  {
    path: 'docs/index.md',
    requiredLinks: ['../README.md', 'README.md', 'technical_manual.md'],
    requiredStrings: ['README.md', 'docs/README.md', 'docs/index.md', 'docs/technical_manual.md', 'queue_recovery_runbook.md', 'railway_logs.md'],
  },
  {
    path: 'docs/technical_manual.md',
    requiredLinks: ['../README.md', 'README.md', 'index.md'],
    requiredStrings: ['/api/v1/maps/expand', 'MAPS_HEADLESS_FALLBACK', 'docs/index.md'],
  },
];

if (optionalCanonicalExists) {
  canonicalDocs.push({
    path: optionalCanonicalDoc,
    requiredLinks: ['../README.md', 'README.md', 'index.md', 'technical_manual.md'],
    requiredStrings: ['docs/index.md', 'docs/technical_manual.md'],
  });
}

for (const doc of canonicalDocs) {
  if (optionalCanonicalExists && doc.path !== optionalCanonicalDoc) {
    doc.requiredLinks = [...doc.requiredLinks, doc.path === 'README.md' ? optionalCanonicalDoc : 'architecture.md'];
    doc.requiredStrings = [...doc.requiredStrings, 'architecture.md'];
  }
}

const criticalRunbooks = [
  'docs/railway_full_setup.md',
  'docs/railway_logs.md',
  'docs/queue_recovery_runbook.md',
  'docs/logistics_recovery_plan.md',
  'docs/support_faq.md',
];

const failures = [];

function readFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function reportFailure(message) {
  failures.push(message);
}

function ensure(condition, message) {
  if (!condition) reportFailure(message);
}

for (const doc of canonicalDocs) {
  ensure(fs.existsSync(path.join(repoRoot, doc.path)), `Missing canonical document: ${doc.path}`);
}

for (const runbookPath of criticalRunbooks) {
  ensure(fs.existsSync(path.join(repoRoot, runbookPath)), `Missing critical runbook: ${runbookPath}`);
}

for (const doc of canonicalDocs) {
  const content = readFile(doc.path);

  for (const requiredLink of doc.requiredLinks) {
    ensure(content.includes(`](${requiredLink})`) || content.includes(`\`${requiredLink}\``), `${doc.path}: missing required link/reference to ${requiredLink}`);
  }

  for (const requiredString of doc.requiredStrings) {
    ensure(content.includes(requiredString), `${doc.path}: missing required search string ${requiredString}`);
  }

  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (/синхрониз|synchronized/i.test(line)) {
      const hasSectionLink = /\]\([^)]*#[^)]+\)/.test(line) || /`[^`]+#[^`]+`/.test(line);
      ensure(hasSectionLink, `${doc.path}:${index + 1}: forbidden "synchronized" claim without section link`);
    }
  });
}

const docsReadme = readFile('docs/README.md');
const docsIndex = readFile('docs/index.md');

for (const runbookPath of criticalRunbooks.map((entry) => path.basename(entry))) {
  ensure(docsReadme.includes(runbookPath), `docs/README.md: missing critical runbook link ${runbookPath}`);
  ensure(docsIndex.includes(runbookPath), `docs/index.md: missing critical runbook link ${runbookPath}`);
}

if (failures.length > 0) {
  console.error('docs QA failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('docs QA passed.');
console.log(`Canonical docs checked: ${canonicalDocs.map((doc) => doc.path).join(', ')}`);
console.log(`Critical runbooks checked: ${criticalRunbooks.join(', ')}`);
