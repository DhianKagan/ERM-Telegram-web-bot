// HTTP API для выдачи задач пользователям
const express = require("express");
const { listUserTasks } = require("../services/service");


const app = express();
app.get('/tasks', async (req, res) => {
    const userId = req.query.userId;
    const tasks = await listUserTasks(userId);
    res.json(tasks);
  });

app.listen(process.env.PORT || 3001);
module.exports = app;
