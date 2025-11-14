// Назначение файла: проверка безопасного перемещения файлов с учётом ограничений файловой системы.
// Основные модули: node:fs/promises, node:os, node:path, utils/moveFile
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { moveFile } from '../../src/utils/moveFile';

describe('moveFile', () => {
  it('перемещает файл и создаёт недостающие каталоги', async () => {
    const sourceRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'move-file-src-'),
    );
    const destinationRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'move-file-dest-'),
    );
    const sourcePath = path.join(sourceRoot, 'source.txt');
    const destinationPath = path.join(destinationRoot, 'nested', 'target.txt');
    await fs.writeFile(sourcePath, 'payload', 'utf8');

    try {
      await moveFile(sourcePath, destinationPath);
      const contents = await fs.readFile(destinationPath, 'utf8');
      expect(contents).toBe('payload');
      await expect(fs.access(sourcePath)).rejects.toThrow();
    } finally {
      await fs.rm(sourceRoot, { recursive: true, force: true });
      await fs.rm(destinationRoot, { recursive: true, force: true });
    }
  });

  it('копирует файл при ошибке EXDEV и удаляет исходник', async () => {
    const sourceRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'move-file-src-exdev-'),
    );
    const destinationRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'move-file-dest-exdev-'),
    );
    const sourcePath = path.join(sourceRoot, 'source.txt');
    const destinationPath = path.join(destinationRoot, 'target.txt');
    await fs.writeFile(sourcePath, 'fallback', 'utf8');

    const renameMock = jest.spyOn(fs, 'rename').mockImplementation(async () => {
      const err = new Error('cross-device link') as NodeJS.ErrnoException;
      err.code = 'EXDEV';
      throw err;
    });
    const copySpy = jest.spyOn(fs, 'copyFile');
    const unlinkSpy = jest.spyOn(fs, 'unlink');

    try {
      await moveFile(sourcePath, destinationPath);
      const contents = await fs.readFile(destinationPath, 'utf8');
      expect(contents).toBe('fallback');
      expect(copySpy).toHaveBeenCalledWith(sourcePath, destinationPath);
      expect(unlinkSpy).toHaveBeenCalledWith(sourcePath);
      await expect(fs.access(sourcePath)).rejects.toThrow();
    } finally {
      renameMock.mockRestore();
      copySpy.mockRestore();
      unlinkSpy.mockRestore();
      await fs.rm(sourceRoot, { recursive: true, force: true });
      await fs.rm(destinationRoot, { recursive: true, force: true });
    }
  });
});
