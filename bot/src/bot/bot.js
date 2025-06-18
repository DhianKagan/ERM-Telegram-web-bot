const { Telegraf } = require('telegraf');
const {createTask, assignTask, listUserTasks, updateTaskStatus} = require('../services/service')
const { verifyAdmin} = require('../auth/auth')
const bot = new Telegraf(process.env.BOT_TOKEN);
require('dotenv').config({ path: './config/.env' });
const express = require('express');
const he = require('../api/api')
require('dotenv').config()
const app = express();
const setupsql = require('../db/model')
setupsql();

app.use('/',he);

bot.start((ctx) => ctx.reply('Welcome to the Task Manager Bot!'));

bot.command('create_task', (ctx) => {
  const user = {
    id: ctx.from.id,
    username: ctx.from.username,
    isAdmin: verifyAdmin(ctx.from.id)
  };
  if (!verifyAdmin(ctx.from.id)) {
    ctx.reply('Unauthorized: Only admins can create tasks.');
    return;
  }
  const token = generateToken(user); 
  const taskDescription = ctx.message.text.split(' ').slice(1).join(' ');
  createTask(taskDescription);
  ctx.reply('Task created successfully!');
});

bot.command('assign_task', (ctx) => {
  if (!verifyAdmin(ctx.from.id) ) {
    ctx.reply('Unauthorized: Only admins can assign tasks.');
    return;
  }
  const [userId, taskId] = ctx.message.text.split(' ').slice(1);
  assignTask(userId, taskId);
  ctx.reply('Task assigned successfully!');
});

bot.command('list_tasks', (ctx) => {
  const tasks = listUserTasks(ctx.from.id);
  const taskList = tasks.map(task => `${task.id}: ${task.description} (${task.status})`).join('\n');
  ctx.reply(taskList);
});

bot.command('update_task_status', (ctx) => {
  const [taskId, status] = ctx.message.text.split(' ').slice(1);
  updateTaskStatus(taskId, status);
  ctx.reply('Task status updated successfully!');
});
console.log("hehe");
app.listen(process.env.PORT, () => console.log('API running on port 3000'));
bot.launch();