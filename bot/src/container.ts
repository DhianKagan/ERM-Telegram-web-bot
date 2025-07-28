// Назначение файла: регистрация сервисов приложения для внедрения зависимостей
// Основные модули: services, api
import { container } from 'tsyringe'
import * as tasks from './services/tasks'
import * as routes from './services/routes'
import * as maps from './services/maps'
import * as telegram from './services/telegramApi'
import * as scheduler from './services/scheduler'

// Регистрация сервисов как значений для последующей инъекции
container.register('TasksService', { useValue: tasks })
container.register('RoutesService', { useValue: routes })
container.register('MapsService', { useValue: maps })
container.register('TelegramApi', { useValue: telegram })
container.register('SchedulerService', { useValue: scheduler })

export default container
