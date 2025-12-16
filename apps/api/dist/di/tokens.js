"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOKENS = void 0;
// Назначение файла: токены для внедрения зависимостей
// Основные модули: tsyringe
exports.TOKENS = {
    TasksRepository: Symbol('TasksRepository'),
    TasksService: Symbol('TasksService'),
    TaskTemplatesService: Symbol('TaskTemplatesService'),
    UsersService: Symbol('UsersService'),
    RolesService: Symbol('RolesService'),
    LogsService: Symbol('LogsService'),
    TaskDraftsService: Symbol('TaskDraftsService'),
    RoutesService: Symbol('RoutesService'),
    MapsService: Symbol('MapsService'),
    TelegramApi: Symbol('TelegramApi'),
    SchedulerService: Symbol('SchedulerService'),
    TmaAuthGuard: Symbol('TmaAuthGuard'),
    BotInstance: Symbol('BotInstance'),
    TaskSyncController: Symbol('TaskSyncController'),
    ArchivesService: Symbol('ArchivesService'),
    StorageRootDir: Symbol('StorageRootDir'),
    FileModel: Symbol('FileModel'),
    TaskModel: Symbol('TaskModel'),
    LogAnalysisService: Symbol('LogAnalysisService'),
    StackOrchestratorService: Symbol('StackOrchestratorService'),
    StackOrchestratorController: Symbol('StackOrchestratorController'),
    StackHealthService: Symbol('StackHealthService'),
    StackHealthController: Symbol('StackHealthController'),
    StorageDiagnosticsService: Symbol('StorageDiagnosticsService'),
    StorageDiagnosticsController: Symbol('StorageDiagnosticsController'),
    TaskDraftsController: Symbol('TaskDraftsController'),
    ReportGeneratorService: Symbol('ReportGeneratorService'),
};
