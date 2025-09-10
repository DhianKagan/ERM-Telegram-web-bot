import 'dotenv/config';
// Назначение файла: стартовый скрипт API.
// Основные модули: di, api
import './di';
import config from './config';
import buildApp from './api/server';

buildApp()
  .then((app) => {
    const port: number = config.port;
    app.listen(port, '0.0.0.0', () => {
      console.log(`API запущен на порту ${port}`);
      console.log(
        `Окружение: ${process.env.NODE_ENV || 'development'}, Node ${process.version}`,
      );
    });
  })
  .catch((e) => {
    console.error('API не стартовал', e);
    process.exit(1);
  });
