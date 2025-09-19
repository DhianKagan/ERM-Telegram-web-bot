// Заполнение тестовыми данными
// Модули: db/model
import { Task, Group, User, Log, Role } from '../../apps/api/src/db/model';
import 'dotenv/config';

async function seed(): Promise<void> {
  const managerRoleExists = await Role.exists({ name: 'manager' });
  if (!managerRoleExists) {
    await Role.create({ name: 'manager' });
  }
  let adminRole = await Role.findOne({ name: 'admin' });
  if (!adminRole) {
    adminRole = await Role.create({ name: 'admin' });
  }

  let group = await Group.findOne({ name: 'Default' });
  if (!group) {
    group = await Group.create({ name: 'Default' });
  }

  let user = await User.findOne({ telegram_id: 1 });
  if (!user) {
    user = await User.create({
      telegram_id: 1,
      username: 'admin',
      role: 'admin',
      roleId: adminRole._id,
      access: 2,
    });
  }

  const taskExists = await Task.exists({
    title: 'Тестовая задача',
    assigned_user_id: user.telegram_id,
  });
  if (!taskExists) {
    await Task.create({
      title: 'Тестовая задача',
      task_description: 'Пример',
      priority: 'Срочно',
      group_id: group._id,
      assigned_user_id: user.telegram_id,
    });
  }

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
