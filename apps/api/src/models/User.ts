// Назначение: модель пользователя для регистрации и входа
// Модули: mongoose
import mongoose, { Schema, Document } from 'mongoose';

interface AuthUser {
  name: string;
  email: string;
  passwordHash: string;
  role: 'user' | 'admin' | 'manager';
}

export type AuthUserDocument = AuthUser & Document;

const UserSchema = new Schema<AuthUserDocument>(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin', 'manager'], default: 'user' },
  },
  { timestamps: true },
);

const AuthUserModel = mongoose.model<AuthUserDocument>('AuthUser', UserSchema);

export default AuthUserModel;
