/**
 * Назначение файла: e2e-тесты маршрута сотрудников с проверкой названий.
 * Основные модули: @playwright/test, express, mongoose, mongodb-memory-server.
 */
import { test, expect } from '@playwright/test';
import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Employee } from '../../apps/api/src/db/models/employee';
import { Department } from '../../apps/api/src/db/models/department';
import { CollectionItem } from '../../apps/api/src/db/models/CollectionItem';
import { Fleet } from '../../apps/api/src/db/models/fleet';

const app = express();

let mongod: MongoMemoryServer;

test.beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  app.get('/employees', async (req, res) => {
    const fields =
      typeof req.query.fields === 'string'
        ? req.query.fields.split(',').join(' ')
        : undefined;
    const employees = await Employee.find({}, fields).populate([
      { path: 'departmentId', select: 'name' },
      { path: 'divisionId', select: 'name' },
      { path: 'positionId', select: 'name' },
    ]);
    res.json(employees);
  });

  const fleet = await Fleet.create({ name: 'Флот', token: 'секрет-флота' });
  const department = await Department.create({
    fleetId: fleet._id,
    name: 'Отдел',
  });
  const division = await CollectionItem.create({
    type: 'divisions',
    name: 'Дивизион',
    value: 'div',
  });
  const position = await CollectionItem.create({
    type: 'roles',
    name: 'Должность',
    value: 'pos',
  });
  await Employee.create({
    name: 'Иван',
    departmentId: department._id,
    divisionId: division._id,
    positionId: position._id,
  });
});

test.afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

test('возвращает названия связанных сущностей', async () => {
  const res = await request(app).get('/employees');
  expect(res.status).toBe(200);
  expect(res.body[0].departmentId.name).toBe('Отдел');
  expect(res.body[0].divisionId.name).toBe('Дивизион');
  expect(res.body[0].positionId.name).toBe('Должность');
});
