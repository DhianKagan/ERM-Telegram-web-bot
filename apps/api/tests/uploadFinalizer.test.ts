/**
 * Назначение файла: тесты нормализации вложений при финализации загрузок.
 * Основные модули: jest, mongoose.
 */
import { Types } from 'mongoose';
import { finalizePendingUploads } from '../src/tasks/uploadFinalizer';
import type RequestWithUser from '../src/types/request';

describe('finalizePendingUploads', () => {
  test('нормализует вложения по fileId и удаляет дубликаты', async () => {
    const fileId = new Types.ObjectId().toHexString();
    const req = {} as RequestWithUser;
    const result = await finalizePendingUploads({
      req,
      attachments: [
        { fileId, name: 'file-a.txt', type: 'text/plain' },
        { fileId, name: 'file-b.txt', type: 'text/plain' },
      ],
    });
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0]).toMatchObject({
      fileId,
      url: `/api/v1/files/${fileId}`,
    });
  });
});
