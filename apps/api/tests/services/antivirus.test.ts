// Назначение: тесты сервиса антивируса. Модули: jest, node:fs/promises, clamdjs, wgLogEngine
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promises as fs } from 'node:fs';
import type { AntivirusConfig } from '../../src/config/antivirus';

const mockPing = jest.fn();
const mockVersion = jest.fn();
const mockIsCleanReply = jest.fn();
const mockScanFile = jest.fn();
const mockCreateScanner = jest.fn(() => ({ scanFile: mockScanFile }));

jest.mock('clamdjs', () => ({
  __esModule: true,
  default: {
    createScanner: mockCreateScanner,
    ping: mockPing,
    version: mockVersion,
    isCleanReply: mockIsCleanReply,
  },
  createScanner: mockCreateScanner,
  ping: mockPing,
  version: mockVersion,
  isCleanReply: mockIsCleanReply,
}));

const mockWriteLog = jest.fn().mockResolvedValue(undefined);

jest.mock('../../src/services/wgLogEngine', () => ({
  writeLog: mockWriteLog,
}));

let mockConfig: AntivirusConfig;

jest.mock('../../src/config/antivirus', () => ({
  get antivirusConfig() {
    return mockConfig;
  },
}));

let scanFile: (path: string) => Promise<boolean>;

async function loadModule(): Promise<void> {
  await jest.isolateModulesAsync(async () => {
    ({ scanFile } = await import('../../src/services/antivirus'));
  });
}

beforeEach(async () => {
  jest.clearAllMocks();
  mockWriteLog.mockResolvedValue(undefined);
  mockPing.mockReset();
  mockVersion.mockReset();
  mockIsCleanReply.mockReset();
  mockScanFile.mockReset();
  mockCreateScanner.mockReset();
  mockCreateScanner.mockImplementation(() => ({ scanFile: mockScanFile }));
  mockVersion.mockResolvedValue('ClamAV test build');
  mockConfig = {
    host: '127.0.0.1',
    port: 3310,
    timeout: 5000,
    chunkSize: 64 * 1024,
    enabled: true,
    vendor: 'ClamAV',
  };
  await loadModule();
});

test('активирует антивирус ClamAV и сканирует файл', async () => {
  mockPing.mockResolvedValue(true);
  mockVersion.mockResolvedValue('ClamAV 1.0.0/27000/Mon Oct 06 12:00:00 2025');
  mockIsCleanReply.mockReturnValue(true);
  mockScanFile.mockResolvedValue('stream: OK');

  const result = await scanFile('/tmp/test.txt');

  expect(result).toBe(true);
  expect(mockPing).toHaveBeenCalledWith('127.0.0.1', 3310, 5000);
  expect(mockCreateScanner).toHaveBeenCalledWith('127.0.0.1', 3310);
  expect(mockScanFile).toHaveBeenCalledWith('/tmp/test.txt', 5000, 65536);
  expect(mockIsCleanReply).toHaveBeenCalledWith('stream: OK');
  expect(mockWriteLog).toHaveBeenCalledWith(
    'Антивирус активирован',
    'info',
    expect.objectContaining({ host: '127.0.0.1', version: expect.any(String) }),
  );
});

test('фиксирует заражённый файл и блокирует загрузку через ClamAV', async () => {
  mockPing.mockResolvedValue(true);
  mockVersion.mockResolvedValue('ClamAV 1.0.0/27000/Mon Oct 06 12:00:00 2025');
  mockIsCleanReply.mockReturnValue(false);
  mockScanFile.mockResolvedValue('stream: Eicar-Test-Signature FOUND');

  const result = await scanFile('/tmp/eicar.txt');

  expect(result).toBe(false);
  expect(mockWriteLog).toHaveBeenCalledWith(
    'Обнаружен вирус',
    'warn',
    expect.objectContaining({
      path: '/tmp/eicar.txt',
      reply: 'stream: Eicar-Test-Signature FOUND',
    }),
  );
});

test('игнорирует сканирование при отключённом ClamAV', async () => {
  mockConfig = {
    host: '127.0.0.1',
    port: 3310,
    timeout: 5000,
    chunkSize: 64 * 1024,
    enabled: false,
    vendor: 'ClamAV',
  };
  await loadModule();

  const result = await scanFile('/tmp/file.txt');

  expect(result).toBe(true);
  expect(mockPing).not.toHaveBeenCalled();
  expect(mockWriteLog).toHaveBeenCalledWith(
    'Антивирус отключён',
    'warn',
    expect.objectContaining({ host: '127.0.0.1' }),
  );
});

test('логирует недоступность демона ClamAV', async () => {
  mockPing.mockResolvedValue(false);
  mockScanFile.mockResolvedValue('stream: OK');
  mockIsCleanReply.mockReturnValue(true);

  const result = await scanFile('/tmp/file.txt');

  expect(result).toBe(true);
  expect(mockWriteLog).toHaveBeenCalledWith(
    'Антивирус недоступен',
    'warn',
    expect.objectContaining({ host: '127.0.0.1' }),
  );
});

test('ошибка сканирования ClamAV блокирует файл и пишет лог', async () => {
  mockPing.mockResolvedValue(true);
  mockIsCleanReply.mockReturnValue(true);
  mockScanFile.mockImplementationOnce(() => Promise.reject(new Error('socket timeout')));

  const result = await scanFile('/tmp/file.txt');

  expect(mockCreateScanner).toHaveBeenCalled();
  expect(mockScanFile).toHaveBeenCalledTimes(1);
  expect(result).toBe(false);
  expect(mockIsCleanReply).not.toHaveBeenCalled();
  expect(mockWriteLog).toHaveBeenCalledWith(
    'Ошибка сканирования',
    'error',
    expect.objectContaining({
      path: '/tmp/file.txt',
      error: 'socket timeout',
    }),
  );
});

describe('сигнатурный сканер', () => {
  const createdFiles: string[] = [];

  afterEach(async () => {
    await Promise.all(
      createdFiles.splice(0).map(async (file) => {
        try {
          await fs.unlink(file);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
      }),
    );
  });

  async function createTempFile(content: string): Promise<string> {
    const filePath = join(tmpdir(), `antivirus-${randomUUID()}.txt`);
    await fs.writeFile(filePath, content);
    createdFiles.push(filePath);
    return filePath;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    mockWriteLog.mockResolvedValue(undefined);
    mockPing.mockReset();
    mockVersion.mockReset();
    mockIsCleanReply.mockReset();
    mockScanFile.mockReset();
    mockCreateScanner.mockReset();
    mockConfig = {
      enabled: true,
      vendor: 'Signature',
      maxFileSize: 1024,
      signatures: ['virus', 'EICAR'],
    };
    await loadModule();
  });

  test('активирует сигнатурный сканер и пропускает безопасный файл', async () => {
    const file = await createTempFile('просто текст без угроз');

    const result = await scanFile(file);

    expect(result).toBe(true);
    expect(mockWriteLog).toHaveBeenCalledWith(
      'Антивирус активирован',
      'info',
      expect.objectContaining({ vendor: 'Signature', signatures: 2 }),
    );
  });

  test('находит сигнатуру и отклоняет файл', async () => {
    const file = await createTempFile('файл содержит EICAR-строку и должен быть отклонён');

    const result = await scanFile(file);

    expect(result).toBe(false);
    expect(mockWriteLog).toHaveBeenCalledWith(
      'Обнаружен вирус',
      'warn',
      expect.objectContaining({ vendor: 'Signature', signature: 'EICAR' }),
    );
  });

  test('блокирует файл, превышающий лимит размера', async () => {
    mockConfig = {
      enabled: true,
      vendor: 'Signature',
      maxFileSize: 8,
      signatures: ['virus'],
    };
    await loadModule();
    const file = await createTempFile('слишком длинное содержимое');

    const result = await scanFile(file);

    expect(result).toBe(false);
    expect(mockWriteLog).toHaveBeenCalledWith(
      'Размер файла превышает лимит сигнатурного сканера',
      'warn',
      expect.objectContaining({ vendor: 'Signature' }),
    );
  });

  test('возвращает false при ошибке чтения файла', async () => {
    await loadModule();

    const result = await scanFile('/tmp/unknown.txt');

    expect(result).toBe(false);
    expect(mockWriteLog).toHaveBeenCalledWith(
      'Ошибка сканирования',
      'error',
      expect.objectContaining({ vendor: 'Signature' }),
    );
  });
});
