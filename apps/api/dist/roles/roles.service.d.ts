interface RolesRepo {
    listRoles(): Promise<unknown>;
    getRole(id: string): Promise<unknown>;
    updateRole(id: string, permissions: unknown): Promise<unknown>;
}
declare class RolesService {
    repo: RolesRepo;
    constructor(repo: RolesRepo);
    list(): Promise<unknown>;
    get(id: string): Promise<unknown>;
    update(id: string, permissions: unknown): Promise<unknown>;
}
export default RolesService;
