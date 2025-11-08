// patch_cjs/001-vite-proxy.cjs
// Добавляет proxy /api -> http://localhost:3001 в Vite-конфиг для локальной разработки

const fs = require("fs");
const path = require("path");

const vitePath = path.resolve("apps/web/vite.config.ts");

if (!fs.existsSync(vitePath)) {
  console.error("❌ vite.config.ts не найден:", vitePath);
  process.exit(1);
}

let src = fs.readFileSync(vitePath, "utf8");

// Проверим, есть ли уже proxy
if (src.includes('"/api"') && src.includes("localhost:3001")) {
  console.log("ℹ️  Proxy уже настроен, изменений не требуется");
  process.exit(0);
}

// Вставляем блок server.proxy внутрь defineConfig
const modified = src.replace(
  /defineConfig\(\{/,
  `defineConfig({
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        secure: false
      }
    }
  },`
);

fs.writeFileSync(vitePath, modified, "utf8");
console.log("✅ Добавлен proxy в", vitePath);
console.log("Теперь локальные запросы /api будут идти на http://localhost:3001");

