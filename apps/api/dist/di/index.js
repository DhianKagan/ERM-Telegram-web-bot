"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.container = void 0;
// Назначение файла: регистрация зависимостей приложения
// Основные модули: tsyringe, services, db
require("reflect-metadata");
const tsyringe_1 = require("tsyringe");
Object.defineProperty(exports, "container", { enumerable: true, get: function () { return tsyringe_1.container; } });
const tokens_1 = require("./tokens");
const routes = __importStar(require("../services/routes"));
const maps_1 = __importDefault(require("../services/maps"));
const telegram = __importStar(require("../services/telegramApi"));
const scheduler = __importStar(require("../services/scheduler"));
const tasks_service_1 = __importDefault(require("../tasks/tasks.service"));
const taskSync_controller_1 = __importDefault(require("../controllers/taskSync.controller"));
const users_service_1 = __importDefault(require("../users/users.service"));
const roles_service_1 = __importDefault(require("../roles/roles.service"));
const logs_service_1 = __importDefault(require("../logs/logs.service"));
const taskTemplates_service_1 = __importDefault(require("../taskTemplates/taskTemplates.service"));
const archives_service_1 = __importDefault(require("../archives/archives.service"));
const queries_1 = __importDefault(require("../db/queries"));
const tmaAuth_guard_1 = __importDefault(require("../auth/tmaAuth.guard"));
const bot_1 = require("../bot/bot");
const storage_1 = require("../config/storage");
const model_1 = require("../db/model");
const logAnalysis_service_1 = __importDefault(require("../system/logAnalysis.service"));
const stackOrchestrator_service_1 = __importDefault(require("../system/stackOrchestrator.service"));
const stackOrchestrator_controller_1 = __importDefault(require("../system/stackOrchestrator.controller"));
const stackHealth_service_1 = __importDefault(require("../system/stackHealth.service"));
const stackHealth_controller_1 = __importDefault(require("../system/stackHealth.controller"));
const storageDiagnostics_service_1 = __importDefault(require("../services/storageDiagnostics.service"));
const storageDiagnostics_controller_1 = __importDefault(require("../controllers/storageDiagnostics.controller"));
const taskDrafts_service_1 = __importDefault(require("../taskDrafts/taskDrafts.service"));
const taskDrafts_controller_1 = __importDefault(require("../taskDrafts/taskDrafts.controller"));
const reportGenerator_1 = __importDefault(require("../services/reportGenerator"));
tsyringe_1.container.register(tokens_1.TOKENS.TasksRepository, { useValue: queries_1.default });
tsyringe_1.container.register(tokens_1.TOKENS.TasksService, {
    useFactory: (c) => new tasks_service_1.default(c.resolve(tokens_1.TOKENS.TasksRepository)),
});
tsyringe_1.container.register(tokens_1.TOKENS.UsersService, {
    useFactory: (c) => new users_service_1.default(c.resolve(tokens_1.TOKENS.TasksRepository)),
});
tsyringe_1.container.register(tokens_1.TOKENS.RolesService, {
    useFactory: (c) => new roles_service_1.default(c.resolve(tokens_1.TOKENS.TasksRepository)),
});
tsyringe_1.container.register(tokens_1.TOKENS.LogsService, {
    useFactory: (c) => new logs_service_1.default(c.resolve(tokens_1.TOKENS.TasksRepository)),
});
tsyringe_1.container.registerSingleton(tokens_1.TOKENS.TaskDraftsService, taskDrafts_service_1.default);
tsyringe_1.container.register(tokens_1.TOKENS.ArchivesService, {
    useFactory: (c) => new archives_service_1.default(c.resolve(tokens_1.TOKENS.TasksRepository)),
});
tsyringe_1.container.register(tokens_1.TOKENS.TaskTemplatesService, {
    useFactory: (c) => new taskTemplates_service_1.default(c.resolve(tokens_1.TOKENS.TasksRepository)),
});
tsyringe_1.container.register(tokens_1.TOKENS.RoutesService, { useValue: routes });
tsyringe_1.container.register(tokens_1.TOKENS.MapsService, { useValue: maps_1.default });
tsyringe_1.container.register(tokens_1.TOKENS.TelegramApi, { useValue: telegram });
tsyringe_1.container.register(tokens_1.TOKENS.SchedulerService, { useValue: scheduler });
tsyringe_1.container.register(tokens_1.TOKENS.TmaAuthGuard, { useValue: tmaAuth_guard_1.default });
tsyringe_1.container.register(tokens_1.TOKENS.BotInstance, { useValue: bot_1.bot });
tsyringe_1.container.registerSingleton(tokens_1.TOKENS.TaskSyncController, taskSync_controller_1.default);
tsyringe_1.container.register(tokens_1.TOKENS.StorageRootDir, { useValue: storage_1.uploadsDir });
tsyringe_1.container.register(tokens_1.TOKENS.FileModel, { useValue: model_1.File });
tsyringe_1.container.register(tokens_1.TOKENS.TaskModel, { useValue: model_1.Task });
tsyringe_1.container.registerSingleton(tokens_1.TOKENS.LogAnalysisService, logAnalysis_service_1.default);
tsyringe_1.container.registerSingleton(tokens_1.TOKENS.StackOrchestratorService, stackOrchestrator_service_1.default);
tsyringe_1.container.registerSingleton(tokens_1.TOKENS.StackOrchestratorController, stackOrchestrator_controller_1.default);
tsyringe_1.container.registerSingleton(tokens_1.TOKENS.StackHealthService, stackHealth_service_1.default);
tsyringe_1.container.registerSingleton(tokens_1.TOKENS.StackHealthController, stackHealth_controller_1.default);
tsyringe_1.container.registerSingleton(tokens_1.TOKENS.StorageDiagnosticsService, storageDiagnostics_service_1.default);
tsyringe_1.container.registerSingleton(tokens_1.TOKENS.StorageDiagnosticsController, storageDiagnostics_controller_1.default);
tsyringe_1.container.registerSingleton(tokens_1.TOKENS.TaskDraftsController, taskDrafts_controller_1.default);
tsyringe_1.container.register(tokens_1.TOKENS.ReportGeneratorService, {
    useFactory: (c) => new reportGenerator_1.default(c.resolve(tokens_1.TOKENS.TasksService)),
});
exports.default = tsyringe_1.container;
