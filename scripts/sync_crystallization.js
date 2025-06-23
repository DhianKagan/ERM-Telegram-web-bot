import fs from 'fs';
import path from 'path';

const repoFile = path.resolve('crystallization.json');
const ideDir = path.resolve('.vscode');
const ideFile = path.join(ideDir, 'crystallization.json');

if (!fs.existsSync(ideDir)) {
  fs.mkdirSync(ideDir);
}

const repoStat = fs.statSync(repoFile).mtimeMs;
const ideExists = fs.existsSync(ideFile);
const ideStat = ideExists ? fs.statSync(ideFile).mtimeMs : 0;

if (ideExists && ideStat > repoStat) {
  fs.copyFileSync(ideFile, repoFile);
  console.log('Repository crystallization.json updated from IDE');
} else {
  fs.copyFileSync(repoFile, ideFile);
  console.log('IDE crystallization.json updated from repository');
}
