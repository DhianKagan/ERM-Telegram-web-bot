// Назначение файла: создание индексов новых коллекций флота
// Основные модули: mongoose, dotenv, модели MongoDB
import mongoose from 'mongoose';
import 'dotenv/config';
import connect from '../apps/api/src/db/connection';
import '../apps/api/src/db/models/fleet';
import '../apps/api/src/db/models/department';
import '../apps/api/src/db/models/employee';

await connect();
await mongoose.connection.db
  .collection('fleets')
  .createIndex({ name: 1 }, { unique: true });
await mongoose.connection.db
  .collection('departments')
  .createIndex({ fleetId: 1 });
await mongoose.connection.db
  .collection('employees')
  .createIndex({ departmentId: 1 });

console.log('Коллекции мигрированы');
process.exit(0);
