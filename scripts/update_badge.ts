// Назначение: обновление бейджа кристаллизации

import fs from 'fs';

function calcAverage(file = 'crystallization.json'): number {
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const scores: number[] = data.tasks.map(
    (t: Record<string, unknown>) => (t.final_score as number | undefined) ?? 0
  );
  const avg = scores.reduce((a, b) => a + b, 0) / (scores.length || 1);
  return +avg.toFixed(2);
}

function updateReadme(percent: number) {
  const readmePath = 'README.md';
  let text = fs.readFileSync(readmePath, 'utf-8');
  text = text.replace(
    /crystallization-\d+%25/,
    `crystallization-${percent}%25`
  );
  text = text.replace(
    /\*\*Current Level:\*\* \d+%/,
    `**Current Level:** ${percent}%`
  );
  fs.writeFileSync(readmePath, text);
  console.log(`README badge updated to ${percent}%`);
}

if (require.main === module) {
  const avg = calcAverage();
  const percent = Math.round(avg * 100);
  updateReadme(percent);
}

export { calcAverage, updateReadme };
