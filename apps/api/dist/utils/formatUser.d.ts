import type { User } from 'shared';
import type { Types } from 'mongoose';
export interface UserLike extends Omit<Partial<User>, 'roleId' | 'departmentId' | 'divisionId' | 'positionId'> {
    telegram_username?: string | null;
    roleId?: string | Types.ObjectId;
    departmentId?: string | Types.ObjectId;
    divisionId?: string | Types.ObjectId;
    positionId?: string | Types.ObjectId;
    toObject?: () => UserLike;
}
export default function formatUser(user: UserLike | null): UserLike | null;
