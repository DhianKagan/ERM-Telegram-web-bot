"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Назначение: CLI-скрипт для запуска экспериментального адаптера OR-Tools на демо-данных.
// Модули: services/vrp/orToolsAdapter
const orToolsAdapter_1 = require("./orToolsAdapter");
async function main() {
    try {
        const result = await (0, orToolsAdapter_1.solveSampleRoute)();
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(result, null, 2));
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error('Ошибка OR-Tools:', error);
        process.exitCode = 1;
    }
}
void main();
