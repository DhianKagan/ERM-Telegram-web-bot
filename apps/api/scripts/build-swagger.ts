// Назначение: генерация статической документации Swagger.
// Основные модули: fs/promises, path, swagger-jsdoc
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { specs } from '../src/api/swagger';

async function build(): Promise<void> {
  const outDir = path.join(__dirname, '../../../docs/api');
  await mkdir(outDir, { recursive: true });
  await writeFile(
    path.join(outDir, 'openapi.json'),
    JSON.stringify(specs, null, 2),
  );

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
  <script>
    window.onload = () => {
      SwaggerUIBundle({ url: 'openapi.json', dom_id: '#swagger-ui' });
    };
  </script>
</body>
</html>`;
  await writeFile(path.join(outDir, 'index.html'), html);
}

build();
