const express = require("express");

const app = express();
app.get('/tasks', async (req, res) => {

    const userId = req.query.userId;
    const tasks = await listUserTasks(userId);
    res.json(tasks);
  });

  module.exports = app;