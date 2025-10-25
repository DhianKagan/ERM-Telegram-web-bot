// Назначение: CLI-скрипт для запуска экспериментального адаптера OR-Tools на демо-данных.
// Модули: services/vrp/orToolsAdapter
import { solveSampleRoute } from './orToolsAdapter';

async function main(): Promise<void> {
  try {
    const result = await solveSampleRoute();
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Ошибка OR-Tools:', error);
    process.exitCode = 1;
  }
}

void main();
