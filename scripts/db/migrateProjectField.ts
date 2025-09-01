// Миграция MongoDB: добавление поля project в задачи
// Модули: mongoose, dotenv, модели проекта
import mongoose from 'mongoose';
import 'dotenv/config';
import '../../apps/api/src/db/model';

await mongoose.connection.db
  .collection('tasks')
  .updateMany({ project: { $exists: false } }, { $set: { project: null } });

await mongoose.connection.db.collection('tasks').createIndex({ project: 1 });

console.log('Поле project добавлено');
process.exit(0);
