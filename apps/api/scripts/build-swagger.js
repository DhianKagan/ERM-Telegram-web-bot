"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Назначение: генерация статической документации Swagger.
// Основные модули: fs/promises, path, swagger-jsdoc, crypto
const promises_1 = require("fs/promises");
const path_1 = __importDefault(require("path"));
const node_crypto_1 = require("node:crypto");
const swagger_1 = require("../src/api/swagger");
async function build() {
    const outDir = path_1.default.join(__dirname, '../../../docs/api');
    await (0, promises_1.mkdir)(outDir, { recursive: true });
    await (0, promises_1.writeFile)(path_1.default.join(outDir, 'openapi.json'), JSON.stringify(swagger_1.specs, null, 2));
    const initSrc = path_1.default.join(outDir, 'swagger-ui-init.ts');
    const initScript = await (0, promises_1.readFile)(initSrc, 'utf8');
    await (0, promises_1.writeFile)(path_1.default.join(outDir, 'swagger-ui-init.js'), initScript);
    const initHash = (0, node_crypto_1.createHash)('sha384').update(initScript).digest('base64');
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
    await (0, promises_1.writeFile)(path_1.default.join(outDir, 'index.html'), html);
}
build();
