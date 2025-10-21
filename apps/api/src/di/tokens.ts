// Назначение файла: токены для внедрения зависимостей
// Основные модули: tsyringe
export const TOKENS = {
  TasksRepository: Symbol('TasksRepository'),
  TasksService: Symbol('TasksService'),
  TaskTemplatesService: Symbol('TaskTemplatesService'),
  UsersService: Symbol('UsersService'),
  RolesService: Symbol('RolesService'),
  LogsService: Symbol('LogsService'),
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
} as const;

type TokenMap = typeof TOKENS;
export type TokenKeys = keyof TokenMap;
export type Token<T extends TokenKeys> = TokenMap[T];
