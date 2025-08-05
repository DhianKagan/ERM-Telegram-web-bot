// Назначение: модель пользователя для регистрации и входа
// Модули: mongoose
import mongoose, { Schema, Document } from 'mongoose';

interface AuthUser {
  name: string;
  email: string;
  passwordHash: string;
  role: 'user' | 'admin';
}

const UserSchema = new Schema<AuthUser>(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
  },
  { timestamps: true },
);

const AuthUserModel = mongoose.model<AuthUser & Document>('AuthUser', UserSchema);

export default AuthUserModel;

// Совместимость с CommonJS
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(module as any).exports = AuthUserModel;
