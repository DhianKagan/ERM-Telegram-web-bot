// Назначение: скрипт для предварительной сборки браузерных файлов AdminJS.
// Модули: @adminjs/bundler, componentLoader из dist.
import { bundle } from '@adminjs/bundler';
import { componentLoader } from './dist/admin/components.bundler.js';

await bundle({ destinationDir: './public', componentLoader });
