// Назначение: генерация статической документации Swagger.
// Основные модули: fs/promises, path, swagger-jsdoc, crypto
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { createHash } from 'node:crypto';
import { specs } from '../src/api/swagger';

async function build(): Promise<void> {
  const outDir = path.join(__dirname, '../../../docs/api');
  await mkdir(outDir, { recursive: true });
  await writeFile(
    path.join(outDir, 'openapi.json'),
    JSON.stringify(specs, null, 2),
  );

  const initSrc = path.join(outDir, 'swagger-ui-init.ts');
  const initScript = await readFile(initSrc, 'utf8');
  await writeFile(path.join(outDir, 'swagger-ui-init.js'), initScript);
  const initHash = createHash('sha384').update(initScript).digest('base64');

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>ERM API</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script src="swagger-ui-init.js" integrity="sha384-${initHash}"></script>
</body>
</html>`;
  await writeFile(path.join(outDir, 'index.html'), html);
}

build();
