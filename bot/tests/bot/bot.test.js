const { Telegraf } = require('telegraf');
const bot = require('./bot'); // Import bot logic

describe('Bot Integration Tests', () => {
  test('start command should reply with a welcome message', async () => {
    const ctx = {
      from: { id: 1 },
      reply: jest.fn(),
    };

    await bot.handleUpdate({ message: { text: '/start', from: ctx.from } });
    expect(ctx.reply).toHaveBeenCalledWith('Welcome to the Task Manager Bot!');
  });

  test('create_task command should only allow admins', async () => {
    const ctx = {
      from: { id: 2 }, // Non-admin user
      message: { text: '/create_task Test task' },
      reply: jest.fn(),
    };

    await bot.handleUpdate({ message: ctx.message, from: ctx.from });
    expect(ctx.reply).toHaveBeenCalledWith('Unauthorized: Only admins can create tasks.');
  });
});
