// Назначение файла: регистрация зависимостей приложения
// Основные модули: tsyringe, services, db
import 'reflect-metadata';
import { container } from 'tsyringe';
import { TOKENS } from './tokens';
import * as routes from '../services/routes';
import maps from '../services/maps';
import * as telegram from '../services/telegramApi';
import * as scheduler from '../services/scheduler';
import TasksService from '../tasks/tasks.service';
import TaskSyncController from '../controllers/taskSync.controller';
import UsersService from '../users/users.service';
import RolesService from '../roles/roles.service';
import LogsService from '../logs/logs.service';
import TaskTemplatesService from '../taskTemplates/taskTemplates.service';
import ArchivesService from '../archives/archives.service';
import queries from '../db/queries';
import tmaAuthGuard from '../auth/tmaAuth.guard';
import { bot } from '../bot/bot';
import { uploadsDir } from '../config/storage';
import { File, Task } from '../db/model';
import LogAnalysisService from '../system/logAnalysis.service';
import StackOrchestratorService from '../system/stackOrchestrator.service';
import StackOrchestratorController from '../system/stackOrchestrator.controller';
import StorageDiagnosticsService from '../services/storageDiagnostics.service';
import StorageDiagnosticsController from '../controllers/storageDiagnostics.controller';
import TaskDraftsService from '../taskDrafts/taskDrafts.service';
import TaskDraftsController from '../taskDrafts/taskDrafts.controller';
import ReportGeneratorService from '../services/reportGenerator';

container.register(TOKENS.TasksRepository, { useValue: queries });
container.register(TOKENS.TasksService, {
  useFactory: (c) => new TasksService(c.resolve(TOKENS.TasksRepository)),
});
container.register(TOKENS.UsersService, {
  useFactory: (c) => new UsersService(c.resolve(TOKENS.TasksRepository)),
});
container.register(TOKENS.RolesService, {
  useFactory: (c) => new RolesService(c.resolve(TOKENS.TasksRepository)),
});
container.register(TOKENS.LogsService, {
  useFactory: (c) => new LogsService(c.resolve(TOKENS.TasksRepository)),
});
container.registerSingleton(TOKENS.TaskDraftsService, TaskDraftsService);
container.register(TOKENS.ArchivesService, {
  useFactory: (c) => new ArchivesService(c.resolve(TOKENS.TasksRepository)),
});
container.register(TOKENS.TaskTemplatesService, {
  useFactory: (c) =>
    new TaskTemplatesService(c.resolve(TOKENS.TasksRepository)),
});
container.register(TOKENS.RoutesService, { useValue: routes });
container.register(TOKENS.MapsService, { useValue: maps });
container.register(TOKENS.TelegramApi, { useValue: telegram });
container.register(TOKENS.SchedulerService, { useValue: scheduler });
container.register(TOKENS.TmaAuthGuard, { useValue: tmaAuthGuard });
container.register(TOKENS.BotInstance, { useValue: bot });
container.registerSingleton(TOKENS.TaskSyncController, TaskSyncController);
container.register(TOKENS.StorageRootDir, { useValue: uploadsDir });
container.register(TOKENS.FileModel, { useValue: File });
container.register(TOKENS.TaskModel, { useValue: Task });
container.registerSingleton(TOKENS.LogAnalysisService, LogAnalysisService);
container.registerSingleton(
  TOKENS.StackOrchestratorService,
  StackOrchestratorService,
);
container.registerSingleton(
  TOKENS.StackOrchestratorController,
  StackOrchestratorController,
);
container.registerSingleton(
  TOKENS.StorageDiagnosticsService,
  StorageDiagnosticsService,
);
container.registerSingleton(
  TOKENS.StorageDiagnosticsController,
  StorageDiagnosticsController,
);
container.registerSingleton(TOKENS.TaskDraftsController, TaskDraftsController);
container.register(TOKENS.ReportGeneratorService, {
  useFactory: (c) =>
    new ReportGeneratorService(c.resolve(TOKENS.TasksService)),
});

export { container };
export default container;
