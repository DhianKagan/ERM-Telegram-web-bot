const { createTask, assignTask } = require('./service');

describe('Service Tests', () => {
  test('createTask should create a task with a pending status', () => {
    const task = createTask('Test task');
    expect(task).toEqual({ id: 1, description: 'Test task', status: 'pending' });
  });

  test('createTask should throw an error if description is missing', () => {
    expect(() => createTask()).toThrow('Task description is required');
  });

  test('assignTask should assign a task to a user', () => {
    const assignment = assignTask(1, 2);
    expect(assignment).toEqual({ userId: 1, taskId: 2 });
  });

  test('assignTask should throw an error if userId or taskId is missing', () => {
    expect(() => assignTask()).toThrow('User ID and Task ID are required');
  });
});
