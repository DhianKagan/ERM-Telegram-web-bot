import React from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpenIcon,
  ClipboardDocumentListIcon,
  InboxArrowDownIcon,
  BookmarkSquareIcon,
  UserCircleIcon,
  ChartPieIcon,
  MapIcon,
  RectangleStackIcon,
  ArchiveBoxIcon,
  CircleStackIcon,
} from '@heroicons/react/24/outline';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/context/useAuth';

type ManualSection = {
  title: string;
  description: string;
  route: string;
  icon: React.ComponentType<React.ComponentProps<'svg'>>;
};

const baseSections: ManualSection[] = [
  {
    title: 'Задачи',
    description:
      'Постановка и контроль задач, фильтрация по статусам и исполнителям, работа с вложениями и сроками.',
    route: '/tasks',
    icon: ClipboardDocumentListIcon,
  },
  {
    title: 'Заявки',
    description:
      'Отдельный поток входящих заявок с обработкой, приоритизацией и переводом в рабочие задачи.',
    route: '/requests',
    icon: InboxArrowDownIcon,
  },
  {
    title: 'Журнал событий',
    description:
      'Фиксация операций по активам и объектам, просмотр истории событий и базовая аналитика изменений.',
    route: '/events',
    icon: BookmarkSquareIcon,
  },
  {
    title: 'Профиль',
    description:
      'Личные данные пользователя, контактная информация и проверка текущей роли/идентификаторов.',
    route: '/profile',
    icon: UserCircleIcon,
  },
];

const managerSections: ManualSection[] = [
  {
    title: 'Канбан (Менеджер)',
    description:
      'Визуальное управление этапами выполнения задач в формате доски по статусам и ответственным.',
    route: '/mg/kanban',
    icon: RectangleStackIcon,
  },
  {
    title: 'Отчёты (Менеджер)',
    description:
      'Сводная аналитика по задачам и активности с фильтрацией по периодам и ключевым параметрам.',
    route: '/mg/reports',
    icon: ChartPieIcon,
  },
  {
    title: 'Логистика (Менеджер)',
    description:
      'Планирование маршрутов, контроль точек и просмотр связанных логистических показателей.',
    route: '/mg/logistics',
    icon: MapIcon,
  },
];

const adminSections: ManualSection[] = [
  {
    title: 'Канбан (Админ)',
    description:
      'Полный канбан-контур для административного управления задачами и распределением нагрузки.',
    route: '/cp/kanban',
    icon: RectangleStackIcon,
  },
  {
    title: 'Отчёты (Админ)',
    description:
      'Детальные отчёты по производственным процессам и контрольным метрикам системы.',
    route: '/cp/reports',
    icon: ChartPieIcon,
  },
  {
    title: 'Логистика (Админ)',
    description:
      'Расширенное управление логистикой, маршрутами и связанными сущностями на уровне администрирования.',
    route: '/cp/logistics',
    icon: MapIcon,
  },
  {
    title: 'Логи (Админ)',
    description:
      'Просмотр системных журналов, диагностика ошибок и анализ служебной активности API и фронтенда.',
    route: '/cp/logs',
    icon: BookOpenIcon,
  },
  {
    title: 'Хранилище (Админ)',
    description:
      'Контроль файлового хранилища: поиск, диагностика «осиротевших» вложений, удаление и обслуживание.',
    route: '/cp/storage',
    icon: CircleStackIcon,
  },
  {
    title: 'Архив (Админ)',
    description:
      'Работа с архивными сущностями: просмотр, фильтрация и аудит завершённых или скрытых записей.',
    route: '/cp/archive',
    icon: ArchiveBoxIcon,
  },
];

export default function FrontendIndex() {
  const { user } = useAuth();
  const role = user?.role || 'user';

  const sections = React.useMemo(() => {
    if (role === 'admin') return [...baseSections, ...adminSections];
    if (role === 'manager') return [...baseSections, ...managerSections];
    return baseSections;
  }, [role]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <Card className="space-y-3 p-6">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Индекс фронтенда и мини-мануал
        </h1>
        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
          Это единая точка входа в интерфейс. Здесь собраны разделы системы с
          кратким описанием функций. Раздел «Настройки» намеренно не включён в
          этот индекс, чтобы фокус оставался на ежедневных рабочих сценариях.
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => (
          <Link
            key={section.route}
            to={section.route}
            className="rounded-xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <section.icon className="h-5 w-5" />
            </div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {section.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {section.description}
            </p>
            <p className="mt-3 text-xs font-medium text-primary">
              Открыть раздел →
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
