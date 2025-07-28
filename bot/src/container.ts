// Назначение файла: регистрация сервисов приложения для внедрения зависимостей
// Основные модули: services, api
require('reflect-metadata')
const { container } = require('tsyringe')
const routes = require('./services/routes')
const maps = require('./services/maps')
const telegram = require('./services/telegramApi')
const scheduler = require('./services/scheduler')
const TasksService = require('./tasks/tasks.service.ts')
const UsersService = require('./users/users.service.ts')
const RolesService = require('./roles/roles.service.ts')
const LogsService = require('./logs/logs.service.ts')
const queries = require('./db/queries')

// Регистрация сервисов для последующей инъекции
container.register('TasksRepository', { useValue: queries })
container.register('TasksService', {
  useFactory: c => new TasksService(c.resolve('TasksRepository')),
})
container.register('UsersService', {
  useFactory: c => new UsersService(c.resolve('TasksRepository')),
})
container.register('RolesService', {
  useFactory: c => new RolesService(c.resolve('TasksRepository')),
})
container.register('LogsService', {
  useFactory: c => new LogsService(c.resolve('TasksRepository')),
})
container.register('RoutesService', { useValue: routes })
container.register('MapsService', { useValue: maps })
container.register('TelegramApi', { useValue: telegram })
container.register('SchedulerService', { useValue: scheduler })

module.exports = container
