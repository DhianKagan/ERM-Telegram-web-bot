// Назначение файла: генерация отчётов задач в форматах PDF и XLSX
// Основные модули: pdfmake, exceljs, services/tasks, tasks/filterUtils
import PdfPrinter from 'pdfmake';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import ExcelJS from 'exceljs';
import type { TaskDocument, UserDocument } from '../db/model';
import type { UserInfo } from '../types/request';
import TasksService from '../tasks/tasks.service';
import {
  normalizeTaskFilters,
  type FilterNormalizationResult,
} from '../tasks/filterUtils';
import { getUsersMap } from '../db/queries';
import { ACCESS_ADMIN, ACCESS_MANAGER } from '../utils/accessMask';

type ReportUser = Pick<UserInfo, 'id' | 'role' | 'access'> | undefined;

export type ReportPayload = {
  data: Buffer;
  contentType: string;
  fileName: string;
};

type UsersLookup = (
  ids: Array<string | number>,
) => Promise<Record<number, UserDocument>>;

type FetchResult = {
  tasks: TaskDocument[];
  users: Record<number, UserDocument>;
  filters: FilterNormalizationResult;
};

type PdfMakeModule = {
  pdfMake?: {
    vfs?: unknown;
  };
};

const isFontRecord = (value: unknown): value is Record<string, string> =>
  typeof value === 'object' &&
  value !== null &&
  Object.values(value).every((item) => typeof item === 'string');

const resolveFontStore = (fonts: unknown): Record<string, string> => {
  if (typeof fonts === 'object' && fonts !== null) {
    const module = fonts as PdfMakeModule;
    const vfs = module.pdfMake?.vfs;
    if (isFontRecord(vfs)) {
      return vfs;
    }
  }
  if (isFontRecord(fonts)) {
    return fonts;
  }
  throw new Error('pdfmake fonts не содержат корректное vfs');
};

const fontStore = resolveFontStore(pdfFonts);

const loadFont = (name: string): Buffer => {
  const content = fontStore[name];
  if (typeof content !== 'string' || !content) {
    throw new Error(`Font ${name} недоступен для pdfmake`);
  }
  return Buffer.from(content, 'base64');
};

const printer = new PdfPrinter({
  Roboto: {
    normal: loadFont('Roboto-Regular.ttf'),
    bold: loadFont('Roboto-Medium.ttf'),
    italics: loadFont('Roboto-Italic.ttf'),
    bolditalics: loadFont('Roboto-MediumItalic.ttf'),
  },
});

const REPORT_PREFIX = 'tasks-report';

const REQUEST_TYPE_NAME = 'Заявка';

export default class ReportGeneratorService {
  constructor(
    private readonly tasksService: TasksService,
    private readonly usersLookup: UsersLookup = getUsersMap,
  ) {}

  async generatePdf(
    filters: Record<string, unknown>,
    user: ReportUser,
  ): Promise<ReportPayload> {
    const result = await this.fetchTasks(filters, user);
    const docDefinition = this.buildPdfDefinition(result);
    const buffer = await this.renderPdf(docDefinition);
    const stamp = this.buildTimestamp();
    return {
      data: buffer,
      contentType: 'application/pdf',
      fileName: `${REPORT_PREFIX}-${stamp}.pdf`,
    };
  }

  async generateExcel(
    filters: Record<string, unknown>,
    user: ReportUser,
  ): Promise<ReportPayload> {
    const {
      tasks,
      users,
      filters: normalized,
    } = await this.fetchTasks(filters, user);
    const workbook = new ExcelJS.Workbook();
    workbook.created = new Date();
    workbook.creator = 'ERM Reports';
    const sheet = workbook.addWorksheet('Задачи');
    sheet.columns = [
      { header: '№', key: 'index', width: 6 },
      { header: 'Номер', key: 'number', width: 18 },
      { header: 'Название', key: 'title', width: 40 },
      { header: 'Статус', key: 'status', width: 18 },
      { header: 'Исполнители', key: 'assignees', width: 32 },
      { header: 'Создана', key: 'created', width: 24 },
    ];
    tasks.forEach((task, index) => {
      sheet.addRow({
        index: index + 1,
        number: this.resolveNumber(task),
        title: this.resolveTitle(task),
        status: this.resolveStatus(task),
        assignees: this.resolveAssignees(task, users),
        created: this.formatDate(this.resolveCreatedAt(task)),
      });
    });
    sheet.getRow(1).font = { bold: true };
    const filtersLabel = this.buildFiltersLabel(normalized);
    if (filtersLabel) {
      sheet.addRow({});
      sheet.addRow({ title: filtersLabel });
    }
    const stamp = this.buildTimestamp();
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return {
      data: buffer,
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fileName: `${REPORT_PREFIX}-${stamp}.xlsx`,
    };
  }

  private async fetchTasks(
    filters: Record<string, unknown>,
    user: ReportUser,
  ): Promise<FetchResult> {
    const normalized = normalizeTaskFilters(filters);
    if (this.isManager(user)) {
      const { tasks } = await this.tasksService.get(normalized.normalized);
      const users = await this.resolveUsers(tasks);
      return { tasks, users, filters: normalized };
    }
    const userId = user?.id != null ? String(user.id) : '';
    const mentioned = await this.tasksService.mentioned(userId);
    const filtered = this.applyUserFilters(
      mentioned as unknown as TaskDocument[],
      normalized,
    );
    const users = await this.resolveUsers(filtered);
    return { tasks: filtered, users, filters: normalized };
  }

  private isManager(user: ReportUser): boolean {
    const role = typeof user?.role === 'string' ? user.role.trim() : '';
    if (role === 'admin' || role === 'manager') {
      return true;
    }
    const mask = typeof user?.access === 'number' ? user.access : 0;
    if ((mask & ACCESS_ADMIN) === ACCESS_ADMIN) {
      return true;
    }
    return (mask & ACCESS_MANAGER) === ACCESS_MANAGER;
  }

  private applyUserFilters(
    tasks: TaskDocument[],
    filters: FilterNormalizationResult,
  ): TaskDocument[] {
    let result = tasks;
    if (filters.kindFilter) {
      result = result.filter(
        (task) => this.detectTaskKind(task) === filters.kindFilter,
      );
    }
    if (filters.statusValues.length) {
      const allowed = new Set(
        filters.statusValues.map((value) => value.trim()),
      );
      result = result.filter((task) =>
        typeof task.status === 'string'
          ? allowed.has(task.status.trim())
          : false,
      );
    }
    if (filters.taskTypeValues.length) {
      const types = new Set(
        filters.taskTypeValues.map((value) => value.trim()),
      );
      result = result.filter((task) => {
        const plain = task as unknown as Record<string, unknown>;
        const raw = plain.task_type;
        const value = typeof raw === 'string' ? raw.trim() : '';
        return value ? types.has(value) : false;
      });
    }
    if (filters.assigneeValues.length) {
      const allowed = new Set(filters.assigneeValues);
      result = result.filter((task) => {
        const ids = this.collectAssigneeIds(task);
        return ids.some((id) => allowed.has(id));
      });
    }
    return result;
  }

  private collectAssigneeIds(task: TaskDocument): number[] {
    const ids = new Set<number>();
    const add = (value: unknown) => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        ids.add(value);
        return;
      }
      if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = Number(value.trim());
        if (Number.isFinite(parsed)) {
          ids.add(parsed);
        }
      }
    };
    const { assignees } = task as unknown as {
      assignees?: unknown;
    };
    if (Array.isArray(assignees)) {
      assignees.forEach(add);
    }
    const rawAssigned = (task as unknown as Record<string, unknown>)
      .assigned_user_id;
    add(rawAssigned);
    return Array.from(ids);
  }

  private async resolveUsers(
    tasks: TaskDocument[],
  ): Promise<Record<number, UserDocument>> {
    const ids = new Set<number>();
    tasks.forEach((task) => {
      this.collectAssigneeIds(task).forEach((id) => ids.add(id));
      const plain = task as unknown as Record<string, unknown>;
      const controllers = plain.controllers;
      if (Array.isArray(controllers)) {
        controllers.forEach((value) => {
          if (typeof value === 'number' && Number.isFinite(value)) {
            ids.add(value);
          }
        });
      }
      const creator = plain.created_by;
      if (typeof creator === 'number' && Number.isFinite(creator)) {
        ids.add(creator);
      }
      if (Array.isArray(task.history)) {
        task.history.forEach((entry) => {
          if (
            entry &&
            typeof entry.changed_by === 'number' &&
            Number.isFinite(entry.changed_by)
          ) {
            ids.add(entry.changed_by);
          }
        });
      }
      const driver = plain.transport_driver_id;
      if (typeof driver === 'number' && Number.isFinite(driver)) {
        ids.add(driver);
      }
    });
    if (ids.size === 0) {
      return {};
    }
    return this.usersLookup(Array.from(ids));
  }

  private buildPdfDefinition({
    tasks,
    users,
    filters,
  }: FetchResult): TDocumentDefinitions {
    const rows = [
      [
        { text: '№', style: 'tableHeader' },
        { text: 'Номер', style: 'tableHeader' },
        { text: 'Название', style: 'tableHeader' },
        { text: 'Статус', style: 'tableHeader' },
        { text: 'Исполнители', style: 'tableHeader' },
        { text: 'Создана', style: 'tableHeader' },
      ],
      ...tasks.map((task, index) => [
        String(index + 1),
        this.resolveNumber(task),
        this.resolveTitle(task),
        this.resolveStatus(task),
        this.resolveAssignees(task, users),
        this.formatDate(this.resolveCreatedAt(task)),
      ]),
    ];
    const filtersLabel = this.buildFiltersLabel(filters);
    const content: TDocumentDefinitions['content'] = [
      { text: 'Отчёт по задачам', style: 'header' },
      {
        text: `Сформировано: ${this.formatDate(new Date())}`,
        style: 'meta',
        margin: [0, 4, 0, filtersLabel ? 4 : 12],
      },
    ];
    if (filtersLabel) {
      content.push({
        text: filtersLabel,
        style: 'meta',
        margin: [0, 0, 0, 12],
      });
    }
    content.push({
      table: {
        headerRows: 1,
        widths: ['auto', 'auto', '*', 'auto', '*', 'auto'],
        body: rows,
      },
      layout: 'lightHorizontalLines',
    });
    return {
      defaultStyle: { font: 'Roboto', fontSize: 11 },
      content,
      styles: {
        header: { fontSize: 16, bold: true },
        tableHeader: { bold: true },
        meta: { fontSize: 10, color: '#666666' },
      },
    };
  }

  private renderPdf(docDefinition: TDocumentDefinitions): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      try {
        const pdfDoc = printer.createPdfKitDocument(docDefinition);
        const chunks: Buffer[] = [];
        pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
        pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
        pdfDoc.on('error', (error: Error) => reject(error));
        pdfDoc.end();
      } catch (error) {
        reject(error as Error);
      }
    });
  }

  private resolveCreatedAt(task: TaskDocument): unknown {
    if (typeof (task as { createdAt?: unknown }).createdAt !== 'undefined') {
      return (task as { createdAt?: unknown }).createdAt;
    }
    const plain = task as unknown as Record<string, unknown>;
    if (typeof plain.created_at !== 'undefined') {
      return plain.created_at;
    }
    return undefined;
  }

  private buildFiltersLabel(filters: FilterNormalizationResult): string {
    const parts: string[] = [];
    if (typeof filters.normalized.from === 'string') {
      parts.push(`С ${filters.normalized.from}`);
    }
    if (typeof filters.normalized.to === 'string') {
      parts.push(`По ${filters.normalized.to}`);
    }
    if (filters.statusValues.length) {
      parts.push(`Статусы: ${filters.statusValues.join(', ')}`);
    }
    if (filters.taskTypeValues.length) {
      parts.push(`Типы: ${filters.taskTypeValues.join(', ')}`);
    }
    if (filters.assigneeValues.length) {
      parts.push(
        `Исполнители: ${filters.assigneeValues
          .map((id) => String(id))
          .join(', ')}`,
      );
    }
    return parts.join(' • ');
  }

  private resolveAssignees(
    task: TaskDocument,
    users: Record<number, UserDocument>,
  ): string {
    const ids = this.collectAssigneeIds(task);
    if (!ids.length) {
      return '—';
    }
    const names = ids
      .map((id) => {
        const user = users[id];
        if (!user) {
          return String(id);
        }
        if (typeof user.name === 'string' && user.name.trim()) {
          return user.name.trim();
        }
        if (typeof user.username === 'string' && user.username.trim()) {
          return user.username.trim();
        }
        return String(id);
      })
      .filter((value) => value.length > 0);
    return names.length ? names.join(', ') : '—';
  }

  private resolveNumber(task: TaskDocument): string {
    const number =
      (task as unknown as Record<string, unknown>).task_number ??
      (task as unknown as Record<string, unknown>).request_id ??
      task.id ??
      task._id;
    if (typeof number === 'string' && number.trim()) {
      return number.trim();
    }
    return String(number ?? '');
  }

  private resolveTitle(task: TaskDocument): string {
    const title = (task as unknown as Record<string, unknown>).title;
    if (typeof title === 'string' && title.trim()) {
      return title.trim();
    }
    return this.resolveNumber(task) || 'Без названия';
  }

  private resolveStatus(task: TaskDocument): string {
    return typeof task.status === 'string' && task.status.trim()
      ? task.status.trim()
      : '—';
  }

  private formatDate(value: unknown): string {
    if (value instanceof Date) {
      if (!Number.isNaN(value.getTime())) {
        return value
          .toISOString()
          .replace('T', ' ')
          .replace(/\.\d+Z$/, 'Z');
      }
      return '—';
    }
    if (typeof value === 'string') {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) {
        return date
          .toISOString()
          .replace('T', ' ')
          .replace(/\.\d+Z$/, 'Z');
      }
    }
    return '—';
  }

  private buildTimestamp(): string {
    return new Date().toISOString().replace(/[:.]/g, '-');
  }

  private detectTaskKind(
    task:
      | (Partial<TaskDocument> & { kind?: unknown; task_type?: unknown })
      | Record<string, unknown>
      | null
      | undefined,
  ): 'task' | 'request' {
    if (!task || typeof task !== 'object') {
      return 'task';
    }
    const source = task as Record<string, unknown>;
    const rawKind = typeof source.kind === 'string' ? source.kind.trim() : '';
    if (rawKind === 'request') {
      return 'request';
    }
    const typeValue =
      typeof source.task_type === 'string' ? source.task_type.trim() : '';
    return typeValue === REQUEST_TYPE_NAME ? 'request' : 'task';
  }
}
