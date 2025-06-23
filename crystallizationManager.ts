import fs from 'fs';
import path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

type KPIDef = {
  key: string;
  title: string;
  threshold: number;
};

type KPIEntry = {
  iteration: number;
  score: number;
  [key: string]: number | boolean | string | undefined;
  is_diamond?: boolean;
};

type Task = {
  id: string;
  title: string;
  status?: string;
  iteration: number;
  kpi_history: KPIEntry[];
  final_score?: number;
  notes?: string;
  complexity?: string;
  tags?: string[];
};

type Data = {
  core_version: number;
  core_principles: string[];
  tasks: Task[];
  kpi_definitions: KPIDef[];
};

const DATA_FILE = path.resolve(__dirname, 'crystallization.json');

function loadData(): Data {
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(raw) as Data;
}

function saveData(data: Data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function calcScore(values: Record<string, number>, defs: KPIDef[]): number {
  let sum = 0;
  defs.forEach((def) => {
    const v = values[def.key];
    if (typeof v === 'number') {
      if (def.key === 'bug_count' || def.key === 'change_failure_rate') {
        sum += v <= def.threshold ? 1 : 0;
      } else {
        sum += v >= def.threshold ? 1 : 0;
      }
    }
  });
  return +(sum / defs.length).toFixed(2);
}

function updateKPI(task: Task, values: Record<string, number>, defs: KPIDef[]) {
  const iter = task.iteration + 1;
  const isDiamond = defs.every((def) => {
    const v = values[def.key];
    if (typeof v !== 'number') return false;
    if (def.key === 'bug_count' || def.key === 'change_failure_rate') {
      return v <= def.threshold;
    }
    return v >= def.threshold;
  });
  const score = isDiamond ? 1.0 : calcScore(values, defs);
  const entry: KPIEntry = {
    iteration: iter,
    score,
    ...values,
    is_diamond: isDiamond,
  };
  task.iteration = iter;
  task.kpi_history.push(entry);
  task.final_score = score;
  if (isDiamond) task.status = 'diamond';
}

yargs(hideBin(process.argv))
  .command(
    'add-task',
    'Add new task',
    (y) =>
      y
        .option('id', { type: 'string', demandOption: true })
        .option('title', { type: 'string', demandOption: true })
        .option('complexity', { type: 'string' })
        .option('tags', { type: 'string' }),
    (argv) => {
      const data = loadData();
      if (data.tasks.find((t) => t.id === argv.id)) {
        console.error('Task already exists');
        return;
      }
      data.tasks.push({
        id: String(argv.id),
        title: String(argv.title),
        status: 'backlog',
        iteration: 0,
        kpi_history: [],
        complexity: argv.complexity ? String(argv.complexity) : undefined,
        tags: argv.tags
          ? String(argv.tags)
              .split(',')
              .map((t) => t.trim())
          : undefined,
      });
      saveData(data);
      console.log('Task added');
    }
  )
  .command(
    'update-kpi',
    'Update KPI values for task',
    (y) =>
      y
        .option('id', { type: 'string', demandOption: true })
        .option('metrics', { type: 'string', demandOption: true }),
    (argv) => {
      const data = loadData();
      const task = data.tasks.find((t) => t.id === argv.id);
      if (!task) {
        console.error('Task not found');
        return;
      }
      let metrics: Record<string, number> = {};
      try {
        metrics = JSON.parse(String(argv.metrics));
      } catch {
        console.error('Invalid metrics JSON');
        return;
      }
      updateKPI(task, metrics, data.kpi_definitions);
      saveData(data);
      console.log(
        task.status === 'diamond'
          ? '💎 Diamond achieved!'
          : `Progressed to iteration ${task.iteration}.`
      );
    }
  )
  .command(
    'update-attrs',
    'Update task complexity and tags',
    (y) =>
      y
        .option('id', { type: 'string', demandOption: true })
        .option('complexity', { type: 'string' })
        .option('tags', { type: 'string' }),
    (argv) => {
      const data = loadData();
      const task = data.tasks.find((t) => t.id === argv.id);
      if (!task) {
        console.error('Task not found');
        return;
      }
      if (argv.complexity) {
        task.complexity = String(argv.complexity);
      }
      if (argv.tags) {
        task.tags = String(argv.tags)
          .split(',')
          .map((t) => t.trim());
      }
      saveData(data);
      console.log('Task attributes updated');
    }
  )
  .command(
    'level',
    'Show crystallization level for task',
    (y) => y.option('id', { type: 'string', demandOption: true }),
    (argv) => {
      const data = loadData();
      const task = data.tasks.find((t) => t.id === argv.id);
      if (!task) {
        console.error('Task not found');
        return;
      }
      console.log(task.final_score ?? '0');
    }
  )
  .command(
    'update-core',
    'Update core principles',
    (y) => y.option('principles', { type: 'string', demandOption: true }),
    (argv) => {
      const data = loadData();
      data.core_principles = String(argv.principles)
        .split(',')
        .map((p) => p.trim());
      data.core_version += 1;
      saveData(data);
      console.log('Core principles updated');
    }
  )
  .command(
    'average',
    'Show average crystallization level',
    () => {},
    () => {
      const data = loadData();
      const scores = data.tasks.map((t) => t.final_score ?? 0);
      const avg = scores.reduce((a, b) => a + b, 0) / (scores.length || 1);
      console.log(avg.toFixed(2));
    }
  )
  .command(
    'list-diamonds',
    'List all tasks in diamond state',
    () => {},
    () => {
      const data = loadData();
      const diamonds = data.tasks.filter((t) => t.status === 'diamond');
      if (diamonds.length === 0) {
        console.log('No diamond tasks');
        return;
      }
      diamonds.forEach((t) => {
        console.log(`${t.id}: ${t.title}`);
      });
    }
  )
  .command(
    'list-funcs',
    'Scan project functions and store the most common',
    () => {},
    async () => {
      const root = path.resolve(__dirname);
      const tsFiles: string[] = [];
      const exclude = ['node_modules', '.git'];

      function gather(dir: string) {
        for (const file of fs.readdirSync(dir)) {
          if (exclude.includes(file)) continue;
          const full = path.join(dir, file);
          const stat = fs.statSync(full);
          if (stat.isDirectory()) {
            gather(full);
          } else if (full.endsWith('.ts')) {
            tsFiles.push(full);
          }
        }
      }

      gather(root);

      const cachePath = path.resolve(root, '.listfuncs_cache.json');
      let cache: Record<
        string,
        { mtime: number; counts: Record<string, number> }
      > = {};
      if (fs.existsSync(cachePath)) {
        try {
          cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
        } catch {
          cache = {};
        }
      }

      const counts: Record<string, number> = {};
      const newCache: typeof cache = {};
      const reg = /function\s+(\w+)|const\s+(\w+)\s*=\s*\(/g;

      await Promise.all(
        tsFiles.map(async (f) => {
          const stat = fs.statSync(f);
          const cached = cache[f];
          if (cached && cached.mtime === stat.mtimeMs) {
            Object.entries(cached.counts).forEach(([name, c]) => {
              counts[name] = (counts[name] || 0) + c;
            });
            newCache[f] = cached;
            return;
          }

          const content = await fs.promises.readFile(f, 'utf-8');
          const fileCounts: Record<string, number> = {};
          let m: RegExpExecArray | null;
          while ((m = reg.exec(content))) {
            const name = m[1] || m[2];
            if (!name) continue;
            fileCounts[name] = (fileCounts[name] || 0) + 1;
            counts[name] = (counts[name] || 0) + 1;
          }
          newCache[f] = { mtime: stat.mtimeMs, counts: fileCounts };
        })
      );

      fs.writeFileSync(cachePath, JSON.stringify(newCache, null, 2));

      const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

      if (entries.length) {
        const result = entries[0];
        const resultPath = path.resolve(root, 'most_common_function.txt');
        fs.writeFileSync(resultPath, `${result[0]}\n`);
        console.log(`Most common function: ${result[0]} (${result[1]})`);
        console.log(`Result saved to ${resultPath}`);
      } else {
        console.log('No functions found');
      }
    }
  )
  .command(
    'list-tasks',
    'List all tasks with statuses',
    () => {},
    () => {
      const data = loadData();
      if (data.tasks.length === 0) {
        console.log('No tasks found');
        return;
      }
      data.tasks.forEach((t) => {
        console.log(`${t.id}: ${t.title} [${t.status ?? 'unknown'}]`);
      });
    }
  )
  .command(
    'stats',
    'Show summary statistics',
    () => {},
    () => {
      const data = loadData();
      const statusCounts: Record<string, number> = {};
      data.tasks.forEach((t) => {
        const status = t.status ?? 'unknown';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
      const avg =
        data.tasks.reduce((sum, t) => sum + (t.final_score ?? 0), 0) /
        (data.tasks.length || 1);
      console.log('Task status counts:');
      Object.entries(statusCounts).forEach(([k, v]) =>
        console.log(`  ${k}: ${v}`)
      );
      console.log(`Average score: ${avg.toFixed(2)}`);
    }
  )
  .command(
    'init',
    'Initialize crystallization in current repo',
    () => {},
    () => {
      const target = path.resolve(process.cwd(), 'crystallization.json');
      if (fs.existsSync(target)) {
        console.error('crystallization.json already exists');
        return;
      }
      const template: Data = {
        core_version: 1,
        core_principles: ['Iterative improvement', 'KPI-driven development'],
        tasks: [],
        kpi_definitions: [
          { key: 'cycle_time_days', title: 'Cycle Time (days)', threshold: 3 },
          { key: 'code_coverage', title: 'Code Coverage', threshold: 0.8 },
        ],
      };
      fs.writeFileSync(target, JSON.stringify(template, null, 2));
      console.log('Initialized crystallization.json');
    }
  )
  .demandCommand()
  .help()
  .strict()
  .parse();
