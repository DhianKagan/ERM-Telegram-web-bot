import fs from 'fs';
import { pathToFileURL } from 'url';

function calcAverage(file = 'crystallization.json') {
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const scores = data.tasks.map(
    (t) => (t.final_score ?? 0)
  );
  const avg = scores.reduce((a, b) => a + b, 0) / (scores.length || 1);
  return +avg.toFixed(2);
}

function updateReadme(percent) {
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

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const avg = calcAverage();
  const percent = Math.round(avg * 100);
  updateReadme(percent);
}

export { calcAverage, updateReadme };
