const request = require('supertest');
const express = require('express');
const routes = require('./routes');

const app = express();
app.use(express.json());
app.use(routes);

describe('API Integration Tests', () => {
  test('POST /tasks should create a new task', async () => {
    const response = await request(app)
      .post('/tasks')
      .send({ description: 'New task' });

    expect(response.statusCode).toBe(201);
    expect(response.body).toEqual({ id: 1, description: 'New task' });
  });

  test('GET /tasks should return the list of tasks', async () => {
    const response = await request(app).get('/tasks');

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual([{ id: 1, description: 'Test task', status: 'pending' }]);
  });
});
