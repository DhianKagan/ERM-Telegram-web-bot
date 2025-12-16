import { UserDocument } from '../db/model';
interface UsersRepo {
    listUsers(): Promise<UserDocument[]>;
    createUser(id: string | number, username?: string, roleId?: string, data?: Omit<Partial<UserDocument>, 'access' | 'role'>): Promise<UserDocument>;
    generateUserCredentials(id?: string | number, username?: string): Promise<{
        telegramId: number;
        username: string;
    }>;
    getUser(id: string | number): Promise<UserDocument | null>;
    updateUser(id: string | number, data: Omit<Partial<UserDocument>, 'access'>): Promise<UserDocument | null>;
    removeUser(id: string | number): Promise<boolean>;
}
declare class UsersService {
    private repo;
    constructor(repo: UsersRepo);
    list(): Promise<UserDocument[]>;
    create(id?: string | number, username?: string, roleId?: string, data?: Omit<Partial<UserDocument>, 'access' | 'role'>): Promise<UserDocument>;
    generate(id?: string | number, username?: string): Promise<{
        telegramId: number;
        username: string;
    }>;
    get(id: string | number): Promise<UserDocument | null>;
    update(id: string | number, data: Omit<Partial<UserDocument>, 'access'>): Promise<UserDocument | null>;
    remove(id: string | number): Promise<boolean>;
}
export default UsersService;
