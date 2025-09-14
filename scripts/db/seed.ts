// Заполнение тестовыми данными
// Модули: db/model, config
import { Task, Group, User, Log, Role } from '../../apps/api/src/db/model';
import config from '../../apps/api/src/config';
import 'dotenv/config';

async function seed(): Promise<void> {
  await Role.create({ _id: config.managerRoleId, name: 'manager' });
  const group = await Group.create({ name: 'Default' });
  const user = await User.create({
    telegram_id: 1,
    username: 'admin',
    role: 'admin',
    roleId: config.adminRoleId,
    access: 2,
  });
  await Task.create({
    title: 'Тестовая задача',
    task_description: 'Пример',
    priority: 'Срочно',
    group_id: group._id,
    assigned_user_id: user.telegram_id,
  });
  await Log.create({ message: 'База заполнена' });
}

seed()
  .then(() => {
    console.log('Добавлены тестовые документы');
    process.exit(0);
  })
  .catch((err: unknown) => {
    const error = err as Error;
    console.error('Ошибка:', error.message);
    process.exit(1);
  });
