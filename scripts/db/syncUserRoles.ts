// Назначение: синхронизация role, roleId и access всех пользователей
// Основные модули: mongoose, db/model, db/queries, config
import mongoose from 'mongoose';
import config from '../../apps/api/src/config';
import { User, Role } from '../../apps/api/src/db/model';
import { accessByRole } from '../../apps/api/src/db/queries';

async function syncRoles() {
  await mongoose.connect(config.mongoUrl);
  const roles = await Role.find().lean();
  const map = new Map(roles.map((r) => [r.name, r._id]));
  const users = await User.find();
  for (const u of users) {
    const role = u.role || 'user';
    const roleId = map.get(role);
    const access = accessByRole(role);
    await User.updateOne({ _id: u._id }, { role, access, roleId });
  }
  await mongoose.disconnect();
}

if (require.main === module) {
  syncRoles().finally(() => process.exit());
}
