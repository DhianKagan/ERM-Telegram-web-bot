#!/usr/bin/env node
/**
 * Назначение: безопасный запуск `husky install` при наличии dev-зависимостей.
 * Модуль: корневые npm-скрипты.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const huskyBin = path.join(process.cwd(), 'node_modules', '.bin', 'husky');

if (!existsSync(huskyBin)) {
  console.log('husky не найден, пропускаем установку git-хуков.');
  process.exit(0);
}

const result = spawnSync(huskyBin, ['install'], { stdio: 'inherit' });

if (result.error) {
  console.error('husky install завершился с ошибкой:', result.error);
  process.exit(1);
}

if (typeof result.status === 'number' && result.status !== 0) {
  process.exit(result.status);
}
