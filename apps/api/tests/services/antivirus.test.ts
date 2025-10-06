// Назначение: тесты сервиса антивируса. Модули: jest, clamdjs, wgLogEngine
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

const configMock: AntivirusConfig = {
  host: '127.0.0.1',
  port: 3310,
  timeout: 5000,
  chunkSize: 64 * 1024,
  enabled: true,
  vendor: 'ClamAV',
};

jest.mock('../../src/config/antivirus', () => ({
  antivirusConfig: configMock,
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
  Object.assign(configMock, {
    host: '127.0.0.1',
    port: 3310,
    timeout: 5000,
    chunkSize: 64 * 1024,
    enabled: true,
    vendor: 'ClamAV' as const,
  });
  await loadModule();
});

test('активирует антивирус и сканирует файл', async () => {
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

test('фиксирует заражённый файл и блокирует загрузку', async () => {
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

test('игнорирует сканирование при отключённом антивирусе', async () => {
  configMock.enabled = false;
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

test('ошибка сканирования блокирует файл и пишет лог', async () => {
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
