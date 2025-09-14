// Назначение: добавление роли manager в существующую базу данных
// Модули: mongoose, Role, config
import mongoose from 'mongoose';
import { Role } from '../../apps/api/src/db/model';
import config from '../../apps/api/src/config';

async function migrate(): Promise<void> {
  await mongoose.connect(config.mongoUrl);
  const exists = await Role.exists({ _id: config.managerRoleId });
  if (!exists) {
    await Role.create({ _id: config.managerRoleId, name: 'manager' });
    console.log('Роль manager добавлена');
  } else {
    console.log('Роль manager уже существует');
  }
  await mongoose.disconnect();
}

if (require.main === module) {
  migrate().finally(() => process.exit());
}
