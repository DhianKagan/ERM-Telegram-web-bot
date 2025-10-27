/**
 * Назначение файла: интеграционные API-тесты CRUD для коллекций.
 * Основные модули: express, supertest, Collection.
 */
import express = require('express');
import request = require('supertest');
import { strict as assert } from 'assert';
import { Collection, Fleet, Department, Employee } from '../../packages/shared/collection-lib';

const app = express();
app.use(express.json());

const fleets = new Collection<Fleet>();
const departments = new Collection<Department>();
const employees = new Collection<Employee>();

app.post('/fleets', (req, res) => {
  const fleet = fleets.create(req.body);
  res.status(201).json(fleet);
});
app.get('/fleets/:id', (req, res) => {
  const fleet = fleets.read(req.params.id);
  if (!fleet) return res.sendStatus(404);
  res.json(fleet);
});

app.post('/departments', (req, res) => {
  const dep = departments.create(req.body);
  res.status(201).json(dep);
});
app.patch('/departments/:id', (req, res) => {
  const dep = departments.update(req.params.id, req.body);
  if (!dep) return res.sendStatus(404);
  res.json(dep);
});

app.post('/employees', (req, res) => {
  const emp = employees.create(req.body);
  res.status(201).json(emp);
});
app.delete('/employees/:id', (req, res) => {
  const ok = employees.delete(req.params.id);
  res.sendStatus(ok ? 204 : 404);
});

describe('API коллекций', () => {
  it('создаёт и читает флот', async () => {
    const create = await request(app)
      .post('/fleets')
      .send({
        id: 'f1',
        name: 'Флот',
        registrationNumber: 'AB 1234 CD',
        odometerInitial: 1000,
        odometerCurrent: 1500,
        mileageTotal: 500,
        fuelType: 'Бензин',
        fuelRefilled: 120,
        fuelAverageConsumption: 0.12,
        fuelSpentTotal: 60,
        currentTasks: ['t1'],
      });
    assert.equal(create.status, 201);
    assert.equal(create.body.registrationNumber, 'AB 1234 CD');
    assert.equal(create.body.currentTasks[0], 't1');
    const read = await request(app).get('/fleets/f1');
    assert.equal(read.body.name, 'Флот');
    assert.equal(read.body.odometerCurrent, 1500);
  });

  it('обновляет отдел', async () => {
    await request(app).post('/departments').send({ id: 'd1', fleetId: 'f1', name: 'Отдел' });
    const upd = await request(app).patch('/departments/d1').send({ name: 'Отдел-2' });
    assert.equal(upd.body.name, 'Отдел-2');
  });

  it('удаляет сотрудника', async () => {
    await request(app).post('/employees').send({ id: 'e1', departmentId: 'd1', name: 'Иван' });
    const del = await request(app).delete('/employees/e1');
    assert.equal(del.status, 204);
  });
});
