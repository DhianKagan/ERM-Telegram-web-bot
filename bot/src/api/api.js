// HTTP API для выдачи задач с проверкой JWT. Модули: express, service, middleware
const express = require('express');
const { listUserTasks } = require('../services/service');
const { verifyToken } = require('./middleware');


const app = express();
app.get('/tasks', verifyToken, async (req, res) => {
  const tasks = await listUserTasks(req.query.userId);
  res.json(tasks);
});

app.listen(process.env.PORT || 3001);
module.exports = app;
