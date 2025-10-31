#!/usr/bin/env node
/**
 * Назначение файла: подготовка JS-файлов для проверки size-limit.
 * Основные модули: node:fs/promises, node:path, node:url.
 */
import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "..", "apps", "web", "dist");
const distJsDir = join(distDir, "js");

async function prepareArtifacts() {
  try {
    await fs.access(distDir);
    await fs.access(distJsDir);
  } catch (error) {
    throw new Error(
      "Каталоги dist/js не найдены. Запустите сборку `pnpm --filter web run build:dist` перед проверкой size-limit.",
    );
  }

  const rootEntries = await fs.readdir(distDir);
  await Promise.all(
    rootEntries
      .filter((name) => name.endsWith(".js") && name.startsWith("index"))
      .map((name) => fs.rm(join(distDir, name))),
  );

  const jsEntries = await fs.readdir(distJsDir);
  const indexFiles = jsEntries.filter(
    (name) => name.endsWith(".js") && name.startsWith("index"),
  );

  if (indexFiles.length === 0) {
    throw new Error("В каталоге dist/js отсутствуют файлы index*.js.");
  }

  await Promise.all(
    indexFiles.map((name) => fs.copyFile(join(distJsDir, name), join(distDir, name))),
  );
}

prepareArtifacts().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
