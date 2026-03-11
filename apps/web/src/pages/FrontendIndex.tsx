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
  CheckCircleIcon,
  AcademicCapIcon,
  PlayIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  QuestionMarkCircleIcon,
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

type OnboardingStep = {
  id: string;
  title: string;
  description: string;
  route?: string;
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
    title: 'Админ панель (Логи)',
    description:
      'Просмотр системных журналов, диагностика ошибок и анализ служебной активности API и фронтенда.',
    route: '/cp/logs',
    icon: BookOpenIcon,
    permission: 'Роль: admin',
  },
  {
    title: 'Админ панель (Файлы)',
    description:
      'Контроль файлового хранилища: поиск, диагностика «осиротевших» вложений, удаление и обслуживание.',
    route: '/cp/storage',
    icon: CircleStackIcon,
    permission: 'Роль: admin',
  },
  {
    title: 'Админ панель (Архив)',
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
          'Основные разделы: Рабочая область (/index), Задачи, Заявки, Журнал событий, Профиль, Канбан, Логистика и Настройки. Для администратора раздел «Админ панель» объединяет пользователей, задачи, отчёты, архив, логи, файлы и мониторинг.',
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
      'Справочники структуры + единая «Админ панель» для пользователей, задач, отчётов, архива, логов, файлов и мониторинга.',
    icon: CircleStackIcon,
    items: [
      {
        id: 'settings-directories',
        question: 'Что включают «Справочники» в настройках?',
        answer:
          'Справочники содержат структуру компании: департаменты, отделы, должности, объекты, автопарк и основные средства. Управление пользователями и настройками задач вынесено в «Админ панель».',
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
          'Вкладка мониторинга проверяет состояние S3, storage API, Redis, MongoDB и внешних сервисов (например, worker/bot), а также предоставляет ссылку на /metrics для Prometheus. Используйте «Запустить проверку» и опцию автоопроса для контроля стабильности.',
        module: 'Мониторинг',
        tags: ['s3', 'redis', 'mongodb', 'prometheus'],
        route: '/cp/settings',
      },
    ],
  },
  {
    id: 'assistant-prompts',
    title: 'AI-ассистент и системные промпты',
    description:
      'Где находится единый источник AI-инструкций и как избегать конфликтующих версий.',
    icon: SparklesIcon,
    items: [
      {
        id: 'assistant-source-of-truth',
        question:
          'Где в проекте хранить и обновлять системные промпты для Codex?',
        answer:
          'Единые инструкции для ассистента поддерживаются только в двух файлах: AGENTS.md и .openai/assistant_instructions.json. Если в README или docs встречаются дубли, их нужно обновить или удалить, чтобы не было конфликтующих правил.',
        module: 'AI Governance',
        tags: ['prompts', 'codex', 'agents', 'source of truth'],
      },
      {
        id: 'assistant-sync-frontend',
        question: 'Зачем разделу /index знать про правила промптов?',
        answer:
          'Развёрнутый фронт и интерактивный FAQ используются как оперативная база знаний для команды. Отдельный блок про AI-инструкции помогает быстро проверить, где вносить изменения и по каким правилам вести PR без расхождений с документацией.',
        module: 'Frontend FAQ',
        tags: ['faq', 'frontend', 'documentation', 'pr'],
        route: '/index',
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

const onboardingSteps: OnboardingStep[] = [
  {
    id: 'open-priority-tasks',
    title: 'Проверьте приоритетные задачи',
    description:
      'Откройте раздел задач и отфильтруйте элементы со срочным приоритетом на текущую смену.',
    route: '/tasks',
  },
  {
    id: 'process-requests',
    title: 'Обработайте входящие заявки',
    description:
      'В заявках разберите свежий поток, валидные обращения переведите в задачи, отклонённые — прокомментируйте.',
    route: '/requests',
  },
  {
    id: 'sync-logistics',
    title: 'Сверьте логистические точки',
    description:
      'Для задач с логистикой проверьте координаты и маршрутные статусы перед стартом выполнения.',
    route: '/mg/logistics',
  },
  {
    id: 'close-day',
    title: 'Закройте цикл дня в журнале',
    description:
      'Зафиксируйте ключевые события и обновите статусы завершённых операций для прозрачной отчётности.',
    route: '/events',
  },
];

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
  const [completedSteps, setCompletedSteps] = React.useState<string[]>([]);
  const [quizIndex, setQuizIndex] = React.useState(0);
  const [quizRevealed, setQuizRevealed] = React.useState(false);
  const [showFaq, setShowFaq] = React.useState(false);
  // collapseState управляет видимостью вторичных блоков на главной странице:
  // true — блок раскрыт, false — свернут и не отвлекает пользователя.
  const [collapseState, setCollapseState] = React.useState({
    checklist: false,
    manuals: false,
    trainer: false,
  });

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

  const onboardingProgress = Math.round(
    (completedSteps.length / onboardingSteps.length) * 100,
  );

  const quizPool = React.useMemo(() => {
    return faqCategories.flatMap((category) => category.items);
  }, []);

  const currentQuizItem = quizPool[quizIndex % quizPool.length];

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

  const toggleStep = (stepId: string) => {
    setCompletedSteps((current) =>
      current.includes(stepId)
        ? current.filter((id) => id !== stepId)
        : [...current, stepId],
    );
  };

  const nextQuiz = () => {
    setQuizIndex((current) => (current + 1) % quizPool.length);
    setQuizRevealed(false);
  };

  const toggleBlock = (block: keyof typeof collapseState) => {
    setCollapseState((current) => ({ ...current, [block]: !current[block] }));
  };

  const actionItems = [
    {
      id: 'task-review',
      title: 'Проверить приоритетные задачи',
      date: 'Сегодня',
      description:
        'Открытые задачи с высоким приоритетом и сроком до конца дня.',
      route: '/tasks',
    },
    {
      id: 'requests',
      title: 'Разобрать новые заявки',
      date: 'Сегодня',
      description:
        'Входящие обращения, которые нужно квалифицировать и назначить.',
      route: '/requests',
    },
    {
      id: 'events',
      title: 'Проверить события в журнале',
      date: 'Завтра',
      description: 'Сверка критичных событий и подтверждение статусов.',
      route: '/events',
    },
  ];

  const taskStatuses = [
    {
      label: 'Открыто',
      value: 12,
      route: '/tasks?status=Open',
      accent: 'bg-rose-500',
    },
    {
      label: 'В работе',
      value: 9,
      route: '/tasks?status=InProgress',
      accent: 'bg-amber-500',
    },
    {
      label: 'На проверке',
      value: 5,
      route: '/tasks?status=Review',
      accent: 'bg-sky-500',
    },
    {
      label: 'Завершено',
      value: 18,
      route: '/tasks?status=Done',
      accent: 'bg-emerald-500',
    },
  ];

  const statCards = [
    {
      key: 'availableSections' as const,
      label: 'Доступные разделы',
      icon: BoltIcon,
      route: '/tasks',
      className:
        'border-sky-200 bg-sky-50/70 dark:border-sky-900/60 dark:bg-sky-950/30',
    },
    {
      key: 'manuals' as const,
      label: 'Персональные инструкции',
      icon: BookOpenIcon,
      route: '/index#manuals',
      className:
        'border-violet-200 bg-violet-50/70 dark:border-violet-900/60 dark:bg-violet-950/30',
    },
    {
      key: 'answers' as const,
      label: 'FAQ',
      icon: QuestionMarkCircleIcon,
      route: '/index#faq',
      className:
        'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/30',
    },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <Card className="space-y-4 border-primary/20 bg-gradient-to-r from-white to-primary/5 p-6 dark:from-slate-900 dark:to-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              Рабочая область
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Главный фокус — текущие задачи и статус исполнения. Дополнительные
              блоки (чек‑лист, мануалы и тренажёр) сворачиваются по умолчанию.
            </p>
          </div>
          <div className="rounded-xl border border-primary/20 bg-white/80 px-4 py-3 text-sm dark:bg-slate-900/80">
            <div className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-200">
              <ShieldCheckIcon className="h-4 w-4 text-primary" />
              Права доступа
            </div>
            <p className="mt-1 text-slate-600 dark:text-slate-300">
              {roleLabel}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Маска: {access}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {statCards.map((item) => (
          <Link key={item.key} to={item.route} className="group">
            <Card
              className={`space-y-2 border p-4 transition hover:-translate-y-0.5 hover:shadow-sm ${item.className}`}
            >
              <div className="flex items-center justify-between">
                <item.icon className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium text-primary">
                  Открыть →
                </span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {item.label}
              </p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                {stats[item.key]}
              </p>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ClockIcon className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Действия сегодня
              </h2>
            </div>
          </div>
          <div className="space-y-3">
            {actionItems.map((item) => (
              <Link
                key={item.id}
                to={item.route}
                className="block rounded-lg border border-slate-200 p-3 transition hover:border-primary/40 dark:border-slate-700"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {item.title}
                  </p>
                  <span className="text-xs text-primary">{item.date}</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                  {item.description}
                </p>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <ChartPieIcon className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Статус задач
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {taskStatuses.map((status) => (
              <Link
                key={status.label}
                to={status.route}
                className="rounded-lg border border-slate-200 p-3 transition hover:border-primary/40 dark:border-slate-700"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${status.accent}`}
                  />
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {status.label}
                  </p>
                </div>
                <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {status.value}
                </p>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5" id="faq">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <LifebuoyIcon className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              FAQ
            </h2>
            <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
              Новых: 3
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowFaq((current) => !current)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-primary/50 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            {showFaq ? 'Скрыть FAQ' : 'Открыть FAQ'}
          </button>
        </div>
        {showFaq && (
          <>
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
              </div>
            </div>
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
              Найдено: {visibleFaqCount} из {faqCount}. FAQ обновлён под новую
              структуру блоков главной страницы.
            </p>
            <div className="space-y-4">
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
                              {item.route && (
                                <Link
                                  to={item.route}
                                  className="text-xs text-primary underline-offset-2 hover:underline"
                                >
                                  Перейти в раздел
                                </Link>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <div className="space-y-4" id="manuals">
        <Card className="p-5">
          <button
            type="button"
            onClick={() => toggleBlock('checklist')}
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            <div className="flex items-center gap-2">
              <CheckCircleIcon className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Чек‑лист рабочего дня
              </h2>
            </div>
            {collapseState.checklist ? (
              <ChevronUpIcon className="h-5 w-5" />
            ) : (
              <ChevronDownIcon className="h-5 w-5" />
            )}
          </button>
          {collapseState.checklist && (
            <div className="mt-4 space-y-3">
              <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${onboardingProgress}%` }}
                />
              </div>
              {onboardingSteps.map((step) => (
                <div
                  key={step.id}
                  className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggleStep(step.id)}
                      className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded border border-slate-300 text-[10px] font-bold text-slate-400 transition hover:border-primary/50"
                    >
                      {completedSteps.includes(step.id) ? '✓' : ''}
                    </button>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {step.title}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="hidden p-5 md:block">
          <button
            type="button"
            onClick={() => toggleBlock('trainer')}
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            <div className="flex items-center gap-2">
              <AcademicCapIcon className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Мини‑тренажёр по ERM
              </h2>
            </div>
            {collapseState.trainer ? (
              <ChevronUpIcon className="h-5 w-5" />
            ) : (
              <ChevronDownIcon className="h-5 w-5" />
            )}
          </button>
          {collapseState.trainer && currentQuizItem && (
            <div className="mt-4 space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4 dark:bg-primary/10">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {currentQuizItem.question}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {quizRevealed
                  ? currentQuizItem.answer
                  : 'Сформулируйте ответ самостоятельно, затем откройте подсказку.'}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setQuizRevealed((c) => !c)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
                >
                  {' '}
                  <PlayIcon className="h-4 w-4" />{' '}
                  {quizRevealed ? 'Скрыть' : 'Показать'} ответ
                </button>
                <button
                  type="button"
                  onClick={nextQuiz}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
                >
                  {' '}
                  <ArrowPathIcon className="h-4 w-4" /> Следующий
                </button>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <button
            type="button"
            onClick={() => toggleBlock('manuals')}
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            <div className="flex items-center gap-2">
              <SparklesIcon className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Мануалы и рабочие сценарии
              </h2>
            </div>
            {collapseState.manuals ? (
              <ChevronUpIcon className="h-5 w-5" />
            ) : (
              <ChevronDownIcon className="h-5 w-5" />
            )}
          </button>
          {collapseState.manuals && (
            <div className="mt-4 space-y-4">
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
          )}
        </Card>
      </div>
    </div>
  );
}
