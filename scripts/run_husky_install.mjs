#!/usr/bin/env node
/**
 * Назначение: безопасный запуск `husky install` при наличии dev-зависимостей и git.
 * Модуль: корневые npm-скрипты.
 *
 * Изменение: добавлена проверка на существование .git — чтобы не пытаться
 * устанавливать git-хуки в CI / в Docker-сборке, где .git отсутствует.
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const cwd = process.cwd();
const gitDir = path.join(cwd, '.git');

// Если .git отсутствует (ровно тот случай, когда сборка идёт из архива/в Docker),
// то устанавливать husky бессмысленно — просто аккуратно выходим.
if (!existsSync(gitDir)) {
  console.log('.git not found — skipping husky install (likely CI / shallow clone).');
  process.exit(0);
}

const huskyBase = path.join(cwd, 'node_modules', '.bin', 'husky');
const huskyBin = process.platform === 'win32' ? `${huskyBase}.cmd` : huskyBase;

if (!existsSync(huskyBin)) {
  console.log('husky не найден, пропускаем установку git-хуков.');
  process.exit(0);
}

// Выполняем установку husky-хуков (stdout/stderr проксируются)
const result = spawnSync(huskyBin, ['install'], { stdio: 'inherit' });

if (result.error) {
  console.error('husky install завершился с ошибкой:', result.error);
  process.exit(1);
}

if (typeof result.status === 'number' && result.status !== 0) {
  process.exit(result.status);
}

// Успешно установлено (или уже установлено)
console.log('husky: git hooks installed (or already present).');
