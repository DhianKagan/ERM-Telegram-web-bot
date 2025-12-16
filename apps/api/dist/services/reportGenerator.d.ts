import type { UserDocument } from '../db/model';
import type { UserInfo } from '../types/request';
import TasksService from '../tasks/tasks.service';
type ReportUser = Pick<UserInfo, 'id' | 'role' | 'access'> | undefined;
export type ReportPayload = {
    data: Buffer;
    contentType: string;
    fileName: string;
};
type UsersLookup = (ids: Array<string | number>) => Promise<Record<number, UserDocument>>;
export default class ReportGeneratorService {
    private readonly tasksService;
    private readonly usersLookup;
    constructor(tasksService: TasksService, usersLookup?: UsersLookup);
    generatePdf(filters: Record<string, unknown>, user: ReportUser): Promise<ReportPayload>;
    generateExcel(filters: Record<string, unknown>, user: ReportUser): Promise<ReportPayload>;
    private fetchTasks;
    private isManager;
    private applyUserFilters;
    private collectAssigneeIds;
    private resolveUsers;
    private buildPdfDefinition;
    private renderPdf;
    private resolveCreatedAt;
    private buildFiltersLabel;
    private resolveAssignees;
    private resolveNumber;
    private resolveTitle;
    private resolveStatus;
    private formatDate;
    private buildTimestamp;
    private detectTaskKind;
}
export {};
