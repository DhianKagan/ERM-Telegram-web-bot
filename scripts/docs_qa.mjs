#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');

const optionalCanonicalDoc = 'docs/architecture.md';
const optionalCanonicalExists = fs.existsSync(
  path.join(repoRoot, optionalCanonicalDoc),
);

const canonicalDocs = [
  {
    path: 'README.md',
    requiredLinks: [
      'docs/README.md',
      'docs/index.md',
      'docs/technical_manual.md',
    ],
    requiredStrings: [
      '/api/v1/maps/expand',
      'MAPS_HEADLESS_FALLBACK',
      'docs/index.md',
      'docs:audit',
    ],
    forbiddenLinks: [
      'docs/codebase_review_2026-02-11.md',
      'docs/workspace-audit-a1.md',
      'docs/routing_research.md',
      'docs/typescript_migration_plan.md',
    ],
  },
  {
    path: 'docs/README.md',
    requiredLinks: [
      '../README.md',
      'index.md',
      'technical_manual.md',
      'archive/README.md',
    ],
    requiredStrings: [
      'docs/index.md',
      'queue_recovery_runbook.md',
      'railway_logs.md',
      'railway_full_setup.md',
    ],
    forbiddenLinks: [
      'codebase_review_2026-02-11.md',
      'workspace-audit-a1.md',
      'routing_research.md',
      'typescript_migration_plan.md',
    ],
  },
  {
    path: 'docs/index.md',
    requiredLinks: [
      '../README.md',
      'README.md',
      'technical_manual.md',
      'archive/README.md',
    ],
    requiredStrings: [
      'README.md',
      'docs/README.md',
      'docs/index.md',
      'technical_manual.md',
      'queue_recovery_runbook.md',
      'railway_logs.md',
      'Полный реестр статусов документов',
      'docs/archive/',
    ],
  },
  {
    path: 'docs/technical_manual.md',
    requiredLinks: ['../README.md', 'README.md', 'index.md'],
    requiredStrings: [
      '/api/v1/maps/expand',
      'MAPS_HEADLESS_FALLBACK',
      'docs/index.md',
      'docs/archive/',
    ],
  },
];

if (optionalCanonicalExists) {
  canonicalDocs.push({
    path: optionalCanonicalDoc,
    requiredLinks: [
      '../README.md',
      'README.md',
      'index.md',
      'technical_manual.md',
    ],
    requiredStrings: ['docs/index.md', 'docs/technical_manual.md'],
  });
}

for (const doc of canonicalDocs) {
  if (optionalCanonicalExists && doc.path !== optionalCanonicalDoc) {
    doc.requiredLinks = [
      ...doc.requiredLinks,
      doc.path === 'README.md' ? optionalCanonicalDoc : 'architecture.md',
    ];
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

const internalOnlyDocs = [
  'docs/queue_recovery_runbook.md',
  'docs/railway_logs.md',
  'docs/railway_minimal_setup.md',
  'docs/railway_s3_setup.md',
  'docs/railway_split_release_preflight.md',
  'docs/railway_split_services.md',
];

const activeDocsSecurityChecks = [
  {
    pattern: /\b[a-z0-9-]+\.railway\.internal\b/i,
    message:
      'Active docs must not contain real Railway internal hostnames; use placeholders like <internal-api-host>.',
  },
  {
    pattern: /https:\/\/[a-z0-9-]+\.up\.railway\.app\b/i,
    message:
      'Active docs must not contain real public Railway hostnames; use placeholders like <public-api-domain>.',
  },
  {
    pattern: /railway\s+login\s+--token\b/i,
    message:
      'Docs must not recommend passing Railway tokens directly in the command line.',
  },
  {
    pattern: /export\s+[A-Z0-9_]*TOKEN[A-Z0-9_]*\s*=\s*/i,
    message:
      'Docs must not recommend exporting tokens directly with inline values; use secure prompts or secret stores.',
  },
  {
    pattern: /^BOT_TOKEN=(?!\"\$BOT_TOKEN\").*set_bot_commands\.sh/im,
    message:
      'Docs must not recommend inline BOT_TOKEN=... command examples; use secure prompts.',
  },
  {
    pattern:
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i,
    message:
      'Active docs must not contain concrete deployment IDs or UUID-like production identifiers.',
  },
];

const docsSecurityScope = [
  'README.md',
  'SECURITY.md',
  'INCIDENT_RESPONSE.md',
  'docs/README.md',
  'docs/index.md',
  ...Array.from(
    new Set(
      fs
        .readdirSync(path.join(repoRoot, 'docs'))
        .filter((entry) => entry.endsWith('.md'))
        .map((entry) => `docs/${entry}`),
    ),
  ),
].filter((entry) => !entry.startsWith('docs/archive/'));

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
  ensure(
    fs.existsSync(path.join(repoRoot, doc.path)),
    `Missing canonical document: ${doc.path}`,
  );
}

for (const runbookPath of criticalRunbooks) {
  ensure(
    fs.existsSync(path.join(repoRoot, runbookPath)),
    `Missing critical runbook: ${runbookPath}`,
  );
}

for (const doc of canonicalDocs) {
  const content = readFile(doc.path);

  for (const requiredLink of doc.requiredLinks) {
    ensure(
      content.includes(`](${requiredLink})`) ||
        content.includes(`\`${requiredLink}\``),
      `${doc.path}: missing required link/reference to ${requiredLink}`,
    );
  }

  for (const requiredString of doc.requiredStrings) {
    ensure(
      content.includes(requiredString),
      `${doc.path}: missing required search string ${requiredString}`,
    );
  }

  for (const forbiddenLink of doc.forbiddenLinks ?? []) {
    ensure(
      !content.includes(`](${forbiddenLink})`) &&
        !content.includes(`\`${forbiddenLink}\``),
      `${doc.path}: forbidden direct entry-point link to historical doc ${forbiddenLink}`,
    );
  }

  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (/синхрониз|synchronized/i.test(line)) {
      const hasSectionLink =
        /\]\([^)]*#[^)]+\)/.test(line) || /`[^`]+#[^`]+`/.test(line);
      ensure(
        hasSectionLink,
        `${doc.path}:${index + 1}: forbidden "synchronized" claim without section link`,
      );
    }
  });
}

const docsReadme = readFile('docs/README.md');
const docsIndex = readFile('docs/index.md');

for (const docPath of internalOnlyDocs) {
  const content = readFile(docPath);
  ensure(
    /Internal-only/i.test(content),
    `${docPath}: missing required Internal-only marker for sensitive operational runbook`,
  );
}

for (const docPath of docsSecurityScope) {
  if (!fs.existsSync(path.join(repoRoot, docPath))) continue;
  const content = readFile(docPath);

  for (const check of activeDocsSecurityChecks) {
    ensure(!check.pattern.test(content), `${docPath}: ${check.message}`);
  }
}

ensure(
  !fs.existsSync(path.join(repoRoot, 'docs/railway_split_readiness_audit.md')),
  'docs/railway_split_readiness_audit.md should not exist in active docs; keep point-in-time audits only in docs/archive/',
);

for (const runbookPath of criticalRunbooks.map((entry) =>
  path.basename(entry),
)) {
  ensure(
    docsReadme.includes(runbookPath),
    `docs/README.md: missing critical runbook link ${runbookPath}`,
  );
  ensure(
    docsIndex.includes(runbookPath),
    `docs/index.md: missing critical runbook link ${runbookPath}`,
  );
}

if (failures.length > 0) {
  console.error('docs audit failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('docs audit passed.');
console.log(
  `Canonical docs checked: ${canonicalDocs.map((doc) => doc.path).join(', ')}`,
);
console.log(`Critical runbooks checked: ${criticalRunbooks.join(', ')}`);
