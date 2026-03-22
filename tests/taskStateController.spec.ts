import { TaskStateController } from '../apps/web/src/controllers/taskStateController';

describe('TaskStateController assignee normalization', () => {
  it('сохраняет задачи в индексе mine при исполнителях-объектах', () => {
    const controller = new TaskStateController();
    const key = 'tasks:task:404:mine:page=1';

    controller.setIndex(
      key,
      [
        {
          _id: 'task-1',
          title: 'Проверить объектного исполнителя',
          assignees: [{ telegram_id: 404 }, { user_id: 404 }, { id: 505 }],
        } as never,
      ],
      {
        kind: 'task',
        mine: true,
        userId: 404,
      },
    );

    const [task] = controller.getIndexSnapshot(key);

    expect(task?._id).toBe('task-1');
    expect(task?.assignees).toEqual([404, 505]);
  });
});
