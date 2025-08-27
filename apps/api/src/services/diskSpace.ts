// Мониторинг свободного места на диске
// Модули: fs, prom-client, services/messageQueue, services/telegramApi, config
import fs from 'fs';
import { Gauge } from 'prom-client';
import { uploadsDir } from '../config/storage';
import { enqueue } from './messageQueue';
import { call } from './telegramApi';
import { chatId } from '../config';
import { register } from '../metrics';

const diskFreeGauge = new Gauge({
  name: 'disk_free_bytes',
  help: 'Свободное место на диске в байтах',
  registers: [register],
});

const THRESHOLD = Number(process.env.DISK_FREE_WARN || 1073741824);
let warned = false;

export async function checkDiskSpace(): Promise<void> {
  try {
    const st = await fs.promises.statfs(uploadsDir);
    const free = st.bfree * st.bsize;
    diskFreeGauge.set(free);
    if (free < THRESHOLD && !warned) {
      warned = true;
      await enqueue(() =>
        call('sendMessage', {
          chat_id: chatId,
          text: `Свободное место на диске менее ${Math.round(free / 1024 / 1024)} МБ`,
        }),
      );
    }
    if (free >= THRESHOLD) warned = false;
  } catch (e) {
    console.error('diskSpace', e);
    await enqueue(() =>
      call('sendMessage', {
        chat_id: chatId,
        text: 'Не удалось проверить свободное место на диске',
      }),
    );
  }
}

export function startDiskMonitor(): void {
  checkDiskSpace();
  setInterval(checkDiskSpace, 60 * 60 * 1000);
}
