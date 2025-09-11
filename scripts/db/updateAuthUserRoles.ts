// Назначение: миграция роли AuthUser для поддержки менеджеров
// Модули: mongoose, models/AuthUser, config
import mongoose from 'mongoose';
import AuthUserModel from '../../apps/api/src/models/User';
import config from '../../apps/api/src/config';

async function migrate() {
  await mongoose.connect(config.mongoUrl);
  await AuthUserModel.updateMany(
    { role: { $nin: ['user', 'admin', 'manager'] } },
    { $set: { role: 'user' } },
  );
  await mongoose.disconnect();
}

if (require.main === module) {
  migrate().finally(() => process.exit());
}
