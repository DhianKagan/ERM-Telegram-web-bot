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
  MagnifyingGlassIcon,
  ArrowsUpDownIcon,
  ArrowPathIcon,
  ClockIcon,
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

type ManualBlock = {
  title: string;
  items: string[];
};

type FaqItem = {
  id: string;
  question: string;
  answer: string;
  module: string;
  tags: string[];
  route?: string;
};

type FaqCategory = {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<React.ComponentProps<'svg'>>;
  items: FaqItem[];
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

const manualBlocks: ManualBlock[] = [
  {
    title: 'Ежедневный цикл работы',
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

const faqCategories: FaqCategory[] = [
  {
    id: 'general',
    title: 'Общие вопросы по ERM',
    description: 'Назначение системы, роли и базовая навигация.',
    icon: BookOpenIcon,
    items: [
      {
        id: 'general-purpose',
        question: 'Что такое ERM и для кого этот портал?',
        answer:
          'ERM — внутренний рабочий портал для управления задачами, заявками, событиями и логистикой с интеграцией в Telegram. Он используется сотрудниками, менеджерами и администраторами, а набор доступных разделов зависит от роли пользователя.',
        module: 'Рабочая область',
        tags: ['обзор', 'роли', 'доступ'],
      },
      {
        id: 'general-navigation',
        question: 'Какие разделы доступны в боковом меню?',
        answer:
          'Основные разделы: Рабочая область, Задачи, Заявки, Журнал событий, Профиль, Канбан, Логистика и Настройки. У менеджера и администратора открываются дополнительные управленческие инструменты.',
        module: 'Навигация',
        tags: ['меню', 'разделы', 'интерфейс'],
      },
      {
        id: 'general-dashboard-start',
        question:
          'Как использовать главную страницу /index для старта рабочего дня?',
        answer:
          'На дашборде проверьте счётчики по доступным разделам и откройте блок «Инструменты по вашему уровню доступа». Затем перейдите в «Задачи» и «Заявки», чтобы обработать приоритетные элементы и обновить статусы в течение дня.',
        module: 'Рабочая область',
        tags: ['старт', 'дашборд', 'план'],
        route: '/index',
      },
    ],
  },
  {
    id: 'tasks',
    title: 'Задачи и канбан',
    description: 'Создание, фильтры, статусы и визуальное управление потоком.',
    icon: ClipboardDocumentListIcon,
    items: [
      {
        id: 'tasks-search',
        question: 'Как быстро найти нужную задачу?',
        answer:
          'Используйте поиск по названию или номеру задачи, а затем примените фильтры по статусу, приоритету, типу, исполнителю и периоду. Это позволяет сузить выборку до конкретного рабочего контекста.',
        module: 'Задачи',
        tags: ['поиск', 'фильтры', 'задачи'],
        route: '/tasks',
      },
      {
        id: 'tasks-create',
        question: 'Что обязательно указать при создании задачи?',
        answer:
          'Рекомендуется заполнить тип задачи, понятное название, приоритет, исполнителя и сроки. До перевода в работу проверьте вложения и комментарии, чтобы исключить повторные уточнения в процессе исполнения.',
        module: 'Задачи',
        tags: ['создание', 'обязательные поля', 'исполнитель'],
        route: '/tasks',
      },
      {
        id: 'kanban-usage',
        question:
          'Когда лучше работать через канбан, а когда через таблицу задач?',
        answer:
          'Таблица удобна для массового поиска и фильтрации, а канбан — для визуального контроля стадий «Новая / В работе / Выполнена» и распределения нагрузки между исполнителями. Обычно команды совмещают оба представления в течение дня.',
        module: 'Канбан',
        tags: ['канбан', 'статусы', 'workflow'],
        route: '/mg/kanban',
      },
    ],
  },
  {
    id: 'requests-events',
    title: 'Заявки и журнал событий',
    description: 'Обработка входящего потока и фиксация операционной истории.',
    icon: BookmarkSquareIcon,
    items: [
      {
        id: 'requests-panel',
        question: 'Как организовать обработку потока заявок?',
        answer:
          'В «Заявках» используйте фильтры по статусу, приоритету, типу и исполнителю, затем сортируйте по периоду. Валидные заявки переводите в задачи, а отклонённые сопровождайте комментариями для прозрачности процесса.',
        module: 'Заявки',
        tags: ['заявки', 'приоритизация', 'обработка'],
        route: '/requests',
      },
      {
        id: 'events-purpose',
        question: 'Для чего нужен журнал событий?',
        answer:
          'Журнал событий хранит историю операций по активам и автопарку: номер, дату/время, тип события, операцию и исполнителя. Он помогает восстановить последовательность действий и провести базовую аналитику причин изменений.',
        module: 'Журнал событий',
        tags: ['аудит', 'история', 'операции'],
        route: '/events',
      },
      {
        id: 'events-new',
        question: 'Как корректно добавить новое событие?',
        answer:
          'Откройте «Новое событие», заполните номер, место и описание, затем проверьте связку с исполнителем. Для точного поиска в будущем используйте ясные формулировки операции и корректную дату.',
        module: 'Журнал событий',
        tags: ['новое событие', 'операция', 'поиск'],
        route: '/events',
      },
    ],
  },
  {
    id: 'logistics',
    title: 'Логистика и маршрутные листы',
    description:
      'Маршрутные листы, транспорт, статусы исполнения и аналитика доставки.',
    icon: MapIcon,
    items: [
      {
        id: 'logistics-routes',
        question: 'Что можно контролировать в маршрутных листах?',
        answer:
          'В разделе логистики отображаются маршрутные листы с задачами, назначенными водителями, транспортом, статусом и деталями выполнения. Можно переключаться между карточками и таблицей, чтобы выбрать удобный формат контроля.',
        module: 'Логистика',
        tags: ['маршрутные листы', 'водители', 'транспорт'],
        route: '/mg/logistics',
      },
      {
        id: 'logistics-filters',
        question: 'Какие фильтры важны для логистики?',
        answer:
          'Базовые фильтры: номер маршрутного листа, водитель, автомобиль и статус. Для оперативной диспетчеризации начинайте с активных статусов «В работе», затем проверяйте отклонения и завершённые рейсы.',
        module: 'Логистика',
        tags: ['фильтры', 'статусы', 'диспетчеризация'],
        route: '/mg/logistics',
      },
    ],
  },
  {
    id: 'settings',
    title: 'Настройки и администрирование',
    description:
      'Справочники, отчёты, архив, логи, файлы и мониторинг компонентов.',
    icon: CircleStackIcon,
    items: [
      {
        id: 'settings-directories',
        question: 'Что включают «Справочники» в настройках?',
        answer:
          'Справочники содержат ключевую структуру компании: департаменты, отделы, должности, объекты, автопарк и основные средства. Здесь же администратор управляет пользователями и доступами.',
        module: 'Настройки',
        tags: ['справочники', 'структура компании', 'доступы'],
        route: '/cp/settings',
      },
      {
        id: 'settings-reports',
        question: 'Какая аналитика есть в отчётах?',
        answer:
          'Отчёты показывают динамику маршрутных планов, загрузку транспорта и SLA по выбранному периоду. Для анализа применяйте фильтры по датам и статусам, затем загружайте обновлённые данные.',
        module: 'Отчёты',
        tags: ['SLA', 'аналитика', 'маршруты'],
        route: '/cp/reports',
      },
      {
        id: 'settings-logs',
        question: 'Как использовать технические логи без шума?',
        answer:
          'Фильтруйте по уровню (error/info), HTTP-методу, endpoint, статусу и периоду. Включайте автоподгрузку только при активной диагностике инцидента, чтобы не перегружать интерфейс лишними событиями.',
        module: 'Логи',
        tags: ['логи', 'диагностика', 'ошибки'],
        route: '/cp/logs',
      },
      {
        id: 'settings-storage',
        question: 'Что проверять в разделе «Файлы»?',
        answer:
          'Контролируйте общее число файлов и количество несвязанных объектов. Перед очисткой хранилища отфильтруйте данные по имени, дате и типу, чтобы случайно не удалить актуальные вложения.',
        module: 'Хранилище',
        tags: ['файлы', 'очистка', 'вложения'],
        route: '/cp/storage',
      },
      {
        id: 'settings-monitoring',
        question: 'Как работает мониторинг инфраструктуры?',
        answer:
          'Вкладка мониторинга проверяет состояние S3, /storage, Redis и MongoDB, а также предоставляет ссылку на /metrics для Prometheus. Используйте «Запустить проверку» и опцию автоопроса для контроля стабильности.',
        module: 'Мониторинг',
        tags: ['s3', 'redis', 'mongodb', 'prometheus'],
        route: '/cp/settings',
      },
    ],
  },
  {
    id: 'faq-maintenance',
    title: 'Обновление FAQ',
    description: 'Как поддерживать раздел актуальным и полезным для команды.',
    icon: ArrowPathIcon,
    items: [
      {
        id: 'faq-update-process',
        question: 'Как организовано постоянное обновление FAQ?',
        answer:
          'FAQ хранится в структурированном виде внутри кода страницы и поддерживает быстрый поиск по тегам, вопросам и ответам. Рекомендуемый процесс: после каждого релиза добавлять новые вопросы по инцидентам, изменениям UI и типовым обращениям пользователей.',
        module: 'FAQ',
        tags: ['обновление', 'релизы', 'база знаний'],
      },
      {
        id: 'faq-what-to-add',
        question: 'Какие вопросы добавлять в FAQ в первую очередь?',
        answer:
          'В первую очередь добавляйте вопросы, которые повторяются в поддержке: ошибки входа, доступы по ролям, работа со статусами задач, экспорт/отчёты и диагностика логистики. Это снижает нагрузку на администраторов и ускоряет адаптацию новых сотрудников.',
        module: 'FAQ',
        tags: ['поддержка', 'частые вопросы', 'адаптация'],
      },
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
    label: 'FAQ-вопросов',
    key: 'answers',
  },
] as const;

function createOpenState(categories: FaqCategory[]): Record<string, boolean> {
  return categories
    .flatMap((category) => category.items)
    .reduce<Record<string, boolean>>((acc, item) => {
      acc[item.id] = false;
      return acc;
    }, {});
}

export default function FrontendIndex() {
  const { user } = useAuth();
  const role = user?.role || 'user';
  const access = typeof user?.access === 'number' ? user.access : 0;
  const [query, setQuery] = React.useState('');
  const [openItems, setOpenItems] = React.useState<Record<string, boolean>>(
    () => createOpenState(faqCategories),
  );

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

  const normalizedQuery = query.trim().toLowerCase();

  const filteredFaq = React.useMemo(() => {
    if (!normalizedQuery) return faqCategories;

    return faqCategories
      .map((category) => ({
        ...category,
        items: category.items.filter((item) => {
          const searchableText = [
            item.question,
            item.answer,
            item.module,
            item.tags.join(' '),
          ]
            .join(' ')
            .toLowerCase();
          return searchableText.includes(normalizedQuery);
        }),
      }))
      .filter((category) => category.items.length > 0);
  }, [normalizedQuery]);

  const faqCount = faqCategories.reduce(
    (sum, category) => sum + category.items.length,
    0,
  );

  const visibleFaqCount = filteredFaq.reduce(
    (sum, category) => sum + category.items.length,
    0,
  );

  const stats = {
    availableSections: sections.length,
    manuals: manualBlocks.length,
    answers: faqCount,
  };

  const toggleItem = (id: string) => {
    setOpenItems((current) => ({
      ...current,
      [id]: !current[id],
    }));
  };

  const toggleAll = (openValue: boolean) => {
    const nextState = createOpenState(faqCategories);
    Object.keys(nextState).forEach((key) => {
      nextState[key] = openValue;
    });
    setOpenItems(nextState);
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <Card className="space-y-4 border-primary/20 bg-gradient-to-r from-white to-primary/5 p-6 dark:from-slate-900 dark:to-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              Рабочая область и интерактивный FAQ
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Главный дашборд проекта: доступ к инструментам, мануалам и полной
              базе частых вопросов по ERM. FAQ структурирован по модулям,
              поддерживает поиск, раскрытие ответов и обновляется после релизов.
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
            <div className="mt-2 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <ClockIcon className="h-3.5 w-3.5" />
              Обновлено: 16 Feb 2026
            </div>
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

      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <LifebuoyIcon className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Полный интерактивный FAQ по проекту
            </h2>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Найдено: {visibleFaqCount} из {faqCount}
          </p>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto]">
          <label className="relative block">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по разделу, вопросу, ответу и ключевым словам"
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none ring-primary/30 transition focus:border-primary focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => toggleAll(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-primary/50 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <ArrowsUpDownIcon className="h-4 w-4" />
              Развернуть всё
            </button>
            <button
              type="button"
              onClick={() => toggleAll(false)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-primary/50 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <ArrowsUpDownIcon className="h-4 w-4" />
              Свернуть всё
            </button>
            <button
              type="button"
              onClick={() => setQuery('')}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-primary/50 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <ArrowPathIcon className="h-4 w-4" />
              Сбросить поиск
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {filteredFaq.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
              По вашему запросу ничего не найдено. Попробуйте изменить
              формулировку или очистить поиск.
            </div>
          )}

          {filteredFaq.map((category) => (
            <div
              key={category.id}
              className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"
            >
              <div className="mb-3 flex items-start gap-2">
                <category.icon className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    {category.title}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {category.description}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {category.items.map((item) => {
                  const isOpen =
                    openItems[item.id] || normalizedQuery.length > 0;
                  return (
                    <div
                      key={item.id}
                      className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"
                    >
                      <button
                        type="button"
                        onClick={() => toggleItem(item.id)}
                        className="flex w-full items-center justify-between gap-4 bg-slate-50 px-4 py-3 text-left transition hover:bg-slate-100 dark:bg-slate-800/70 dark:hover:bg-slate-800"
                      >
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {item.question}
                        </span>
                        <span className="text-xs font-medium text-primary">
                          {isOpen ? 'Скрыть' : 'Показать'}
                        </span>
                      </button>

                      {isOpen && (
                        <div className="space-y-3 bg-white px-4 py-3 dark:bg-slate-900">
                          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                            {item.answer}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="rounded-full bg-primary/10 px-2 py-1 font-medium text-primary">
                              Модуль: {item.module}
                            </span>
                            {item.tags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full bg-slate-100 px-2 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                              >
                                #{tag}
                              </span>
                            ))}
                            {item.route && (
                              <Link
                                to={item.route}
                                className="text-primary underline-offset-2 hover:underline"
                              >
                                Перейти в раздел
                              </Link>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
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
  );
}
