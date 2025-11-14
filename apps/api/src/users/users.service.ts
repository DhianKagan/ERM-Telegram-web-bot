// Сервис пользователей через репозиторий
// Основные модули: db/queries, utils/formatUser
import { UserDocument } from '../db/model';

interface UsersRepo {
  listUsers(): Promise<UserDocument[]>;
  createUser(
    id: string | number,
    username?: string,
    roleId?: string,
    data?: Omit<Partial<UserDocument>, 'access' | 'role'>,
  ): Promise<UserDocument>;
  generateUserCredentials(
    id?: string | number,
    username?: string,
  ): Promise<{ telegramId: number; username: string }>;
  getUser(id: string | number): Promise<UserDocument | null>;
  updateUser(
    id: string | number,
    data: Omit<Partial<UserDocument>, 'access'>,
  ): Promise<UserDocument | null>;
  removeUser(id: string | number): Promise<boolean>;
}

class UsersService {
  private repo: UsersRepo;

  constructor(repo: UsersRepo) {
    this.repo = repo;
  }

  list() {
    return this.repo.listUsers();
  }

  async create(
    id?: string | number,
    username?: string,
    roleId?: string,
    data: Omit<Partial<UserDocument>, 'access' | 'role'> = {},
  ) {
    const { telegramId, username: resolvedUsername } =
      await this.repo.generateUserCredentials(id, username);
    return this.repo.createUser(telegramId, resolvedUsername, roleId, data);
  }

  generate(id?: string | number, username?: string) {
    return this.repo.generateUserCredentials(id, username);
  }

  get(id: string | number) {
    return this.repo.getUser(id);
  }

  update(id: string | number, data: Omit<Partial<UserDocument>, 'access'>) {
    return this.repo.updateUser(id, data);
  }

  remove(id: string | number) {
    return this.repo.removeUser(id);
  }
}

export default UsersService;
