// Назначение файла: регистрация сервисов приложения для внедрения зависимостей
// Основные модули: services, api
import "reflect-metadata";
import { container } from "tsyringe";
import * as routes from "./services/routes";
import maps from "./services/maps";
import * as telegram from "./services/telegramApi";
import * as scheduler from "./services/scheduler";
import TasksService from "./tasks/tasks.service";
import UsersService from "./users/users.service";
import RolesService from "./roles/roles.service";
import LogsService from "./logs/logs.service";
import queries from "./db/queries";
import tmaAuthGuard from "./auth/tmaAuth.guard";

// Регистрация сервисов для последующей инъекции
container.register("TasksRepository", { useValue: queries });
container.register("TasksService", {
  useFactory: (c) => new TasksService(c.resolve("TasksRepository")),
});
container.register("UsersService", {
  useFactory: (c) => new UsersService(c.resolve("TasksRepository")),
});
container.register("RolesService", {
  useFactory: (c) => new RolesService(c.resolve("TasksRepository")),
});
container.register("LogsService", {
  useFactory: (c) => new LogsService(c.resolve("TasksRepository")),
});
container.register("RoutesService", { useValue: routes });
container.register("MapsService", { useValue: maps });
container.register("TelegramApi", { useValue: telegram });
container.register("SchedulerService", { useValue: scheduler });
container.register("tmaAuthGuard", { useValue: tmaAuthGuard });

export default container;
