import matchTaskQuery from '../apps/web/src/utils/matchTaskQuery';

describe('matchTaskQuery', () => {
  it('находит задачу по исполнителю, если API вернул исполнителей объектами', () => {
    const task = {
      _id: 'task-1',
      id: 'task-1',
      title: 'Доставка документов',
      status: 'Новая',
      assignees: [{ telegram_id: 102, name: 'Иванова Анна' }],
    } as never;

    const users = {
      102: {
        name: 'Иванова Анна',
        username: 'anna',
      },
    };

    expect(matchTaskQuery(task, 'анна', users)).toBe(true);
  });
});
