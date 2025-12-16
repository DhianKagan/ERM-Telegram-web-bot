import mongoose, { Document } from 'mongoose';
interface AuthUser {
    name: string;
    email: string;
    passwordHash: string;
    role: 'user' | 'admin' | 'manager';
}
export type AuthUserDocument = AuthUser & Document;
declare const AuthUserModel: mongoose.Model<AuthUserDocument, {}, {}, {}, mongoose.Document<unknown, {}, AuthUserDocument, {}, {}> & AuthUser & mongoose.Document<unknown, any, any, Record<string, any>, {}> & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
export default AuthUserModel;
