/**
 * Назначение файла: проверка контраста apps/web/index.html через @axe-core/cli.
 * Основные модули: child_process, http.
 */
import { spawn } from 'node:child_process';
import http from 'node:http';

async function waitForServer(url: string, timeoutMs = 10000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      http
        .get(url, (res) => {
          res.destroy();
          resolve();
        })
        .on('error', () => {
          if (Date.now() - start > timeoutMs) {
            reject(new Error('Сервер не запустился'));
            return;
          }
          setTimeout(check, 250);
        });
    };
    check();
  });
}

(async () => {
  const build = spawn('pnpm', ['--dir', 'apps/web', 'build'], {
    stdio: 'inherit',
  });
  const buildCode: number = await new Promise((resolve) =>
    build.on('exit', resolve),
  );
  if (buildCode !== 0) {
    process.exit(buildCode);
  }

  const driver = spawn(
    'npx',
    ['-y', 'browser-driver-manager', 'install', 'chrome'],
    {
      stdio: 'inherit',
    },
  );
  const driverCode: number = await new Promise((resolve) =>
    driver.on('exit', resolve),
  );
  if (driverCode !== 0) {
    process.exit(driverCode);
  }

  const server = spawn(
    'pnpm',
    ['--dir', 'apps/web', 'preview', '--port', '4173', '--strictPort'],
    {
      stdio: 'inherit',
    },
  );

  try {
    await waitForServer('http://localhost:4173');
    const axe = spawn(
      'npx',
      [
        '@axe-core/cli',
        'http://localhost:4173/index.html',
        '--tags',
        'color-contrast',
        '--chrome-options',
        'no-sandbox,disable-dev-shm-usage',
      ],
      { stdio: 'inherit' },
    );
    const code: number = await new Promise((resolve) =>
      axe.on('exit', resolve),
    );
    server.kill();
    process.exit(code);
  } catch (err) {
    server.kill();
    console.error(err);
    process.exit(1);
  }
})();
