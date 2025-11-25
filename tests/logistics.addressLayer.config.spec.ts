/**
 * Назначение файла: проверка конфигурации адресных плиток и fallback значений.
 * Основные модули: apps/web/src/config/map.
 */
import fs from 'node:fs';

describe('config map: адресные плитки', () => {
  const originalEnv = process.env.VITE_MAP_ADDRESSES_PMTILES_URL;
  const resetImportMetaEnv = () => {
    delete (globalThis as { __ERM_IMPORT_META_ENV__?: unknown })
      .__ERM_IMPORT_META_ENV__;
  };

  afterEach(() => {
    process.env.VITE_MAP_ADDRESSES_PMTILES_URL = originalEnv;
    resetImportMetaEnv();
    jest.resetModules();
  });

  it('возвращает локальный путь при отсутствии переменной окружения', async () => {
    delete process.env.VITE_MAP_ADDRESSES_PMTILES_URL;
    resetImportMetaEnv();
    jest.resetModules();

    const config = await import('../apps/web/src/config/map');

    expect(config.MAP_ADDRESSES_PMTILES_URL).toBe(
      'pmtiles://tiles/addresses.pmtiles',
    );
    expect(config.MAP_ADDRESSES_PMTILES_SOURCE).toBe('local');
  });

  it('использует значение из переменной окружения', async () => {
    process.env.VITE_MAP_ADDRESSES_PMTILES_URL =
      'pmtiles://custom/addresses.pmtiles';
    resetImportMetaEnv();
    jest.resetModules();

    const config = await import('../apps/web/src/config/map');

    expect(config.MAP_ADDRESSES_PMTILES_URL).toBe(
      'pmtiles://custom/addresses.pmtiles',
    );
    expect(config.MAP_ADDRESSES_PMTILES_SOURCE).toBe('env');
  });

  it('логирует ошибку при отсутствии файла и переменной', async () => {
    const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    delete process.env.VITE_MAP_ADDRESSES_PMTILES_URL;
    resetImportMetaEnv();
    jest.resetModules();

    const config = await import('../apps/web/src/config/map');

    expect(config.MAP_ADDRESSES_PMTILES_URL).toBe('');
    expect(config.MAP_ADDRESSES_PMTILES_SOURCE).toBe('missing');
    expect(consoleSpy).toHaveBeenCalled();

    existsSpy.mockRestore();
    consoleSpy.mockRestore();
  });
});
