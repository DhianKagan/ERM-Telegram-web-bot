#!/usr/bin/env node
// patch: 086-restore-husky-sh.cjs
// purpose: восстановить shim Husky для корректной инициализации хуков
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const patchPath = path.resolve(__dirname, '086-restore-husky-sh.patch');
const huskyPath = path.resolve(__dirname, '..', '.husky', '_', 'husky.sh');
const shim = `#!/bin/sh

if [ -z "$husky_skip_init" ]; then
  debug() {
    [ "$HUSKY_DEBUG" = "1" ] && echo "husky: $*"
  }

  readonly hook_name="$(basename "$0")"
  debug "starting $hook_name..."

  if [ "$HUSKY" = "0" ]; then
    debug "HUSKY env variable is set to 0, skipping hook"
    exit 0
  fi

  if [ -f ~/.huskyrc ]; then
    debug "~/.huskyrc found, sourcing..."
    . ~/.huskyrc
  fi

  export husky_skip_init=1
  sh -e "$0" "$@"
fi
`;

if (fs.existsSync(patchPath)) {
  try {
    execSync(`git apply "${patchPath}"`, { stdio: 'inherit' });
    process.exit(0);
  } catch (error) {
    console.warn('Не удалось применить патч, переходим к восстановлению файла вручную');
  }
}

fs.writeFileSync(huskyPath, shim, 'utf8');
fs.chmodSync(huskyPath, 0o755);
console.log('Husky shim restored');
