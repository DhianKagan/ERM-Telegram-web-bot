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
  getUser(id: string | number): Promise<UserDocument | null>;
  updateUser(
    id: string | number,
    data: Omit<Partial<UserDocument>, 'access'>,
  ): Promise<UserDocument | null>;
}

class UsersService {
  private repo: UsersRepo;

  constructor(repo: UsersRepo) {
    this.repo = repo;
  }

  list() {
    return this.repo.listUsers();
  }

  create(
    id: string | number,
    username?: string,
    roleId?: string,
    data: Omit<Partial<UserDocument>, 'access' | 'role'> = {},
  ) {
    return this.repo.createUser(id, username, roleId, data);
  }

  get(id: string | number) {
    return this.repo.getUser(id);
  }

  update(id: string | number, data: Omit<Partial<UserDocument>, 'access'>) {
    return this.repo.updateUser(id, data);
  }
}

export default UsersService;
