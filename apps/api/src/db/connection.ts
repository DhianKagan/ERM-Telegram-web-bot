// Управление подключением к MongoDB с пулом соединений и резервным URL
// Модули: mongoose, config
import mongoose, { ConnectOptions, Connection } from 'mongoose';
import config from '../config';

const { mongoUrl } = config;
const backupUrl = process.env.MONGO_BACKUP_URL;
// Увеличиваем количество попыток подключения по умолчанию,
// чтобы Railway успел запустить MongoDB
const attempts = Number(process.env.RETRY_ATTEMPTS || 10);
const delayMs = Number(process.env.RETRY_DELAY_MS || 5000);

// Для версии mongoose 8 опции useNewUrlParser и useUnifiedTopology
// больше не требуются, оставляем только размер пула
const opts: ConnectOptions = { maxPoolSize: 10 };
let connecting: Promise<typeof mongoose> | null;

mongoose.connection.on('disconnected', async () => {
  console.error('Соединение с MongoDB прервано');
  if (backupUrl && mongoUrl !== backupUrl) {
    try {
      await mongoose.connect(backupUrl, opts);
      console.log('Подключились к резервной базе');
    } catch (e: unknown) {
      const err = e as { message?: string };
      console.error('Ошибка подключения к резервной базе:', err.message);
    }
  }
});
mongoose.connection.on('error', (e: unknown) => {
  const err = e as { message?: string };
  console.error('Ошибка MongoDB:', err.message);
});

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export default async function connect(): Promise<Connection> {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (connecting) {
    await connecting;
    return mongoose.connection;
  }
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      connecting = mongoose.connect(mongoUrl, opts);
      await connecting;
      return mongoose.connection;
    } catch (e: unknown) {
      const err = e as { message?: string };
      console.error(`Попытка ${attempt} не удалась:`, err.message);
      if (attempt === attempts) throw e;
      await sleep(delayMs);
    } finally {
      connecting = null;
    }
  }
  return mongoose.connection;
}
