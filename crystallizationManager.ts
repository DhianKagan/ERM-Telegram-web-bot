/**
 * Управление файлом crystallization.json и вывод CLI-команд.
 * Модули: fs для работы с файлом, yargs для CLI.
 */
import fs from 'fs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { pathToFileURL } from 'url';

interface KPIEntry {
  iteration: number;
  score: number;
  notes?: string;
}

interface Task {
  id: string;
  title: string;
  status: string;
  iteration: number;
  kpi_history: KPIEntry[];
  final_score: number;
  notes?: string;
}

interface Data {
  core_version: number;
  core_principles: string[];
  tasks: Task[];
  kpi_definitions: string[];
}

export class Manager {
  file: string;
  data: Data;
  constructor(file = 'crystallization.json') {
    this.file = file;
    this.data = JSON.parse(fs.readFileSync(this.file, 'utf-8')) as Data;
  }
  save() {
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
  }
  addTask(t: Task) {
    this.data.tasks.push(t);
    this.save();
    console.log(`✅ Task ${t.id} added.`);
  }
  updateKPI(id: string, score: number, notes?: string) {
    const task = this.data.tasks.find((x) => x.id === id);
    if (!task) return console.log(`❌ Task ${id} not found`);
    const iter = task.iteration + 1;
    task.kpi_history.push({ iteration: iter, score, notes });
    task.iteration = iter;
    task.final_score = score;
    this.save();
    console.log(`✅ KPI updated: ${score}`);
  }
  level(id: string) {
    const task = this.data.tasks.find((x) => x.id === id);
    if (!task) return console.log(`❌ Task ${id} not found`);
    console.log(`Level ${Math.round(task.final_score * 100)}%`);
  }
  updateCore(principles: string[], bump = true) {
    if (bump) this.data.core_version += 1;
    this.data.core_principles = principles;
    this.save();
    console.log('✅ Core updated');
  }
  average(): number {
    const sum = this.data.tasks.reduce((a, t) => a + (t.final_score || 0), 0);
    const avg = +(sum / this.data.tasks.length * 100).toFixed(1) || 0;
    console.log(`Average: ${avg}%`);
    return avg;
  }
}

export function runCLI() {
  const m = new Manager();
  yargs(hideBin(process.argv))
    .command('add-task', 'Добавить задачу', (y) => y
      .option('id', { type: 'string', demandOption: true })
      .option('title', { type: 'string', demandOption: true })
      .option('status', { type: 'string', default: 'backlog' })
      .option('iteration', { type: 'number', default: 0 })
      .option('final_score', { type: 'number', default: 0 })
      .option('notes', { type: 'string' }),
      (argv) => {
        m.addTask({
          id: argv.id,
          title: argv.title,
          status: argv.status,
          iteration: argv.iteration,
          kpi_history: [],
          final_score: argv.final_score,
          notes: argv.notes,
        });
    })
    .command('update-kpi', 'Обновить KPI', (y) => y
      .option('id', { type: 'string', demandOption: true })
      .option('score', { type: 'number', demandOption: true })
      .option('notes', { type: 'string' }),
      (argv) => {
        m.updateKPI(argv.id, argv.score, argv.notes);
    })
    .command('level', 'Показать уровень задачи', (y) => y.option('id', { type: 'string', demandOption: true }),
      (argv) => m.level(argv.id))
    .command('update-core', 'Обновить принципы', (y) => y
      .option('principles', { type: 'string', demandOption: true })
      .option('versionIncrement', { type: 'boolean', default: true }),
      (argv) => {
        m.updateCore((argv.principles as string).split(','), argv.versionIncrement);
    })
    .command('average', 'Средний уровень', () => {}, () => m.average())
    .demandCommand()
    .help()
    .parse();
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCLI();
}
