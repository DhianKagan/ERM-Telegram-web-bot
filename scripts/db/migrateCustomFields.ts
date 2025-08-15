// Миграция MongoDB: переименование custom_fields в custom
// Модули: mongoose, dotenv, модели проекта
import mongoose from 'mongoose';
import 'dotenv/config';
import '../../bot/src/db/model';

await mongoose.connection.db
  .collection('tasks')
  .updateMany(
    { custom_fields: { $exists: true }, custom: { $exists: false } },
    { $rename: { custom_fields: 'custom' } },
  );

console.log('Поле custom_fields переименовано в custom');
process.exit(0);
