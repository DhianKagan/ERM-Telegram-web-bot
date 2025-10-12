// Назначение: проверяет, что анализ логов Railway выявляет ошибки форматирования и включает автокоманду
// Основные модули: child_process, fs, os, path
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('analyze_railway_logs.mjs', () => {
  test('выдаёт рекомендацию форматирования и автозапуск команды', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'railway-analysis-'));
    const logPath = path.join(tempDir, 'deploy.log');
    fs.writeFileSync(
      logPath,
      [
        '2025-01-05T10:15:00Z ERROR Formatting issues detected by Prettier',
        '2025-01-05T10:15:01Z ERROR Run pnpm lint --fix to resolve problems',
      ].join('\n'),
      'utf8',
    );

    const result = spawnSync(
      'node',
      [
        'scripts/analyze_railway_logs.mjs',
        logPath,
        '--prefix',
        'test-case',
        '--output-dir',
        tempDir,
      ],
      { encoding: 'utf8' },
    );

    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout.trim());
    const analysisPath = output.jsonPath as string;
    const report = JSON.parse(fs.readFileSync(analysisPath, 'utf8'));

    const formatRecommendation = report.recommendations.find(
      (item: { id: string }) => item.id === 'format-code',
    );

    expect(formatRecommendation).toBeDefined();
    if (!formatRecommendation) {
      throw new Error('Рекомендация форматирования не обнаружена');
    }
    expect(formatRecommendation.autoRun).toBe(true);
    expect(formatRecommendation.command).toBe('pnpm format');

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
