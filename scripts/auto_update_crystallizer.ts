/**
 * Назначение: автоматическое обновление кристализатора из репозитория.
 * Модули: fs, child_process.
 */
import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const VERSION_FILE = path.resolve(__dirname, 'crystallizer_commit.txt');
const REPO_COMMITS =
  'https://api.github.com/repos/AgroxOD/crystallization-development/commits?per_page=1';
const SOURCE_FILE =
  'https://raw.githubusercontent.com/AgroxOD/crystallization-development/main/cli-implementations/js/crystallizationManager.ts';

function getLatestSha(): string {
  const out = execSync(`curl -s ${REPO_COMMITS}`).toString();
  const data = JSON.parse(out);
  return data[0].sha as string;
}

function readLocalSha(): string | null {
  try {
    return fs.readFileSync(VERSION_FILE, 'utf-8').trim();
  } catch {
    return null;
  }
}

function writeLocalSha(sha: string) {
  fs.writeFileSync(VERSION_FILE, `${sha}\n`);
}

function updateCrystallizer() {
  const sha = getLatestSha();
  const local = readLocalSha();
  if (sha === local) {
    console.log('Кристализатор актуален');
    return;
  }
  execSync(`curl -sSL ${SOURCE_FILE} -o crystallizationManager.ts`);
  writeLocalSha(sha);
  console.log(`Кристализатор обновлён до ${sha}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  updateCrystallizer();
}
