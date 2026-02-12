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
  ShieldCheckIcon,
  BoltIcon,
  LifebuoyIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/context/useAuth';

type DashboardSection = {
  title: string;
  description: string;
  route: string;
  icon: React.ComponentType<React.ComponentProps<'svg'>>;
  permission: string;
};

type QuickAnswer = {
  question: string;
  answer: string;
};

type ManualBlock = {
  title: string;
  items: string[];
};

const baseSections: DashboardSection[] = [
  {
    title: 'Задачи',
    description:
      'Постановка и контроль задач, фильтрация по статусам и исполнителям, работа с вложениями и сроками.',
    route: '/tasks',
    icon: ClipboardDocumentListIcon,
    permission: 'Доступно всем ролям',
  },
  {
    title: 'Заявки',
    description:
      'Отдельный поток входящих заявок с обработкой, приоритизацией и переводом в рабочие задачи.',
    route: '/requests',
    icon: InboxArrowDownIcon,
    permission: 'Доступно всем ролям',
  },
  {
    title: 'Журнал событий',
    description:
      'Фиксация операций по активам и объектам, просмотр истории событий и базовая аналитика изменений.',
    route: '/events',
    icon: BookmarkSquareIcon,
    permission: 'Доступно всем ролям',
  },
  {
    title: 'Профиль',
    description:
      'Личные данные пользователя, контактная информация и проверка текущей роли/идентификаторов.',
    route: '/profile',
    icon: UserCircleIcon,
    permission: 'Доступно всем ролям',
  },
];

const managerSections: DashboardSection[] = [
  {
    title: 'Канбан (Менеджер)',
    description:
      'Визуальное управление этапами выполнения задач в формате доски по статусам и ответственным.',
    route: '/mg/kanban',
    icon: RectangleStackIcon,
    permission: 'Роль: manager / admin',
  },
  {
    title: 'Отчёты (Менеджер)',
    description:
      'Сводная аналитика по задачам и активности с фильтрацией по периодам и ключевым параметрам.',
    route: '/mg/reports',
    icon: ChartPieIcon,
    permission: 'Роль: manager / admin',
  },
  {
    title: 'Логистика (Менеджер)',
    description:
      'Планирование маршрутов, контроль точек и просмотр связанных логистических показателей.',
    route: '/mg/logistics',
    icon: MapIcon,
    permission: 'Роль: manager / admin',
  },
];

const adminSections: DashboardSection[] = [
  {
    title: 'Канбан (Админ)',
    description:
      'Полный канбан-контур для административного управления задачами и распределением нагрузки.',
    route: '/cp/kanban',
    icon: RectangleStackIcon,
    permission: 'Роль: admin',
  },
  {
    title: 'Отчёты (Админ)',
    description:
      'Детальные отчёты по производственным процессам и контрольным метрикам системы.',
    route: '/cp/reports',
    icon: ChartPieIcon,
    permission: 'Роль: admin',
  },
  {
    title: 'Логистика (Админ)',
    description:
      'Расширенное управление логистикой, маршрутами и связанными сущностями на уровне администрирования.',
    route: '/cp/logistics',
    icon: MapIcon,
    permission: 'Роль: admin',
  },
  {
    title: 'Логи (Админ)',
    description:
      'Просмотр системных журналов, диагностика ошибок и анализ служебной активности API и фронтенда.',
    route: '/cp/logs',
    icon: BookOpenIcon,
    permission: 'Роль: admin',
  },
  {
    title: 'Хранилище (Админ)',
    description:
      'Контроль файлового хранилища: поиск, диагностика «осиротевших» вложений, удаление и обслуживание.',
    route: '/cp/storage',
    icon: CircleStackIcon,
    permission: 'Роль: admin',
  },
  {
    title: 'Архив (Админ)',
    description:
      'Работа с архивными сущностями: просмотр, фильтрация и аудит завершённых или скрытых записей.',
    route: '/cp/archive',
    icon: ArchiveBoxIcon,
    permission: 'Роль: admin',
  },
];

const quickAnswers: QuickAnswer[] = [
  {
    question: 'С чего начать рабочий день?',
    answer:
      'Откройте блок «Задачи», проверьте просроченные карточки и входящие заявки. Далее обновите статус по активным поручениям.',
  },
  {
    question: 'Где смотреть историю изменений?',
    answer:
      'Используйте «Журнал событий». Для расширенной диагностики и технического аудита администратору доступен раздел «Логи».',
  },
  {
    question: 'Как понять свои права?',
    answer:
      'В верхней части дашборда отображается текущая роль и numeric access. Карточки ниже автоматически фильтруются по этим правам.',
  },
];

const manualBlocks: ManualBlock[] = [
  {
    title: 'Быстрый мануал по задачам',
    items: [
      'Создайте задачу или примите её из заявок.',
      'Назначьте исполнителя и приоритет.',
      'Проверьте сроки и вложения перед переводом в следующий статус.',
    ],
  },
  {
    title: 'Работа с заявками',
    items: [
      'Фильтруйте входящие по срочности и источнику.',
      'Переводите валидные заявки в задачи.',
      'Фиксируйте комментарии по отклонённым обращениям.',
    ],
  },
  {
    title: 'Управление личной эффективностью',
    items: [
      'В профиле проверьте роль и контактные данные.',
      'Ведите ежедневный цикл: план → работа → отчёт.',
      'Используйте события для самоанализа и ретроспективы.',
    ],
  },
];

const personalStats = [
  {
    label: 'Доступных разделов',
    key: 'availableSections',
  },
  {
    label: 'Личных инструкций',
    key: 'manuals',
  },
  {
    label: 'Быстрых ответов',
    key: 'answers',
  },
] as const;

export default function FrontendIndex() {
  const { user } = useAuth();
  const role = user?.role || 'user';
  const access = typeof user?.access === 'number' ? user.access : 0;

  const sections = React.useMemo(() => {
    if (role === 'admin') return [...baseSections, ...adminSections];
    if (role === 'manager') return [...baseSections, ...managerSections];
    return baseSections;
  }, [role]);

  const roleLabel =
    role === 'admin'
      ? 'Администратор'
      : role === 'manager'
        ? 'Менеджер'
        : 'Пользователь';

  const stats = {
    availableSections: sections.length,
    manuals: manualBlocks.length,
    answers: quickAnswers.length,
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <Card className="space-y-4 border-primary/20 bg-gradient-to-r from-white to-primary/5 p-6 dark:from-slate-900 dark:to-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              Рабочая область
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Главный дашборд проекта: доступ к рабочим инструментам,
              инструкциям по разделам, ответам на частые вопросы и персональным
              ориентирам на день.
            </p>
          </div>
          <div className="rounded-xl border border-primary/20 bg-white/80 px-4 py-3 text-sm dark:bg-slate-900/80">
            <div className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-200">
              <ShieldCheckIcon className="h-4 w-4 text-primary" />
              Права доступа
            </div>
            <p className="mt-1 text-slate-600 dark:text-slate-300">
              Роль: {roleLabel}
            </p>
            <p className="text-slate-600 dark:text-slate-300">
              Уровень access: {access}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {personalStats.map((item) => (
          <Card key={item.key} className="space-y-2 p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {item.label}
            </p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {stats[item.key]}
            </p>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <BoltIcon className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Инструменты по вашему уровню доступа
          </h2>
        </div>
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
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {section.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {section.description}
              </p>
              <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                {section.permission}
              </p>
              <p className="mt-3 text-xs font-medium text-primary">
                Открыть раздел →
              </p>
            </Link>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <LifebuoyIcon className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Ответы на частые вопросы
            </h2>
          </div>
          <div className="space-y-4">
            {quickAnswers.map((item) => (
              <div
                key={item.question}
                className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/70"
              >
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {item.question}
                </h3>
                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {item.answer}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <SparklesIcon className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Мануалы и рабочие сценарии
            </h2>
          </div>
          <div className="space-y-4">
            {manualBlocks.map((block) => (
              <div
                key={block.title}
                className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"
              >
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {block.title}
                </h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {block.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
