// Назначение файла: стартовый скрипт API.
// Основные модули: di, api
import './di';
import config from './config';
import buildApp from './api/server';
import http from 'node:http';
import mongoose from 'mongoose';
import { closeQueueBundles } from './queues/taskQueue';
import { stopQueueMetricsPoller } from './queues/queueMetrics';
import { stopDiskMonitor } from './services/diskSpace';
import { stopQueue } from './services/messageQueue';
import { closeCacheClient } from './utils/cache';
import { markHealthcheckGraceStart } from './api/healthcheck';

const shutdownTimeoutMs = Number(process.env.SHUTDOWN_TIMEOUT_MS || 30000);

buildApp()
  .then((app) => {
    const port: number = config.port;
    const server = http.createServer(app);
    let shuttingDown = false;

    server.listen(port, '0.0.0.0', () => {
      markHealthcheckGraceStart();
      console.log(`API запущен на порту ${port}`);
      console.log(
        `Окружение: ${process.env.NODE_ENV || 'development'}, Node ${process.version}`,
      );
    });

    const closeServer = async (): Promise<void> =>
      new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });

    const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
      if (shuttingDown) {
        return;
      }
      shuttingDown = true;
      console.log(`Получен сигнал ${signal}, начинаем остановку...`);

      const forceTimer = setTimeout(() => {
        console.error('Принудительное завершение из-за превышения таймаута');
        process.exit(1);
      }, shutdownTimeoutMs);
      forceTimer.unref?.();

      try {
        await closeServer();
      } catch (error) {
        console.error('Ошибка при остановке HTTP сервера', error);
      }

      stopQueueMetricsPoller();
      stopDiskMonitor();
      stopQueue();

      await closeQueueBundles();
      await closeCacheClient();

      if (mongoose.connection.readyState !== 0) {
        try {
          await mongoose.connection.close(false);
        } catch (error) {
          console.error('Ошибка при закрытии MongoDB соединения', error);
        }
      }

      clearTimeout(forceTimer);
      process.exit(0);
    };

    process.on('SIGINT', () => {
      void shutdown('SIGINT');
    });
    process.on('SIGTERM', () => {
      void shutdown('SIGTERM');
    });
  })
  .catch((e) => {
    console.error('API не стартовал', e);
    process.exit(1);
  });
