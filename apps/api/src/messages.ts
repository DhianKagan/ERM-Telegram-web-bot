// Назначение: список текстовых ответов бота на команды Telegram
// Основные модули: отсутствуют
const messages = {
  accessOnlyGroup: 'Доступ разрешён только участникам группы',
  accessError: 'Ошибка проверки доступа',
  registered: 'Вы зарегистрированы в системе.',
  welcomeBack: 'С возвращением!',
  codeSent: 'Код подтверждения отправлен в Telegram',
  miniAppLinkText: 'Открыть приложение',
  idLabel: 'Ваш ID',
  statusLabel: 'Статус в группе',
  unauthorizedCreateTask:
    'Недостаточно прав: только администраторы могут создавать задачи.',
  taskNameRequired: 'Укажите название задачи после команды',
  taskCreated: 'Задача создана.',
  taskCreatedInApp: 'Задача создана через приложение',
  unauthorizedAssignTask:
    'Недостаточно прав: только администраторы могут назначать задачи.',
  taskAssigned: 'Задача назначена.',
  adminsOnly: 'Только для админов',
  invalidAddUserFormat: 'Формат: /add_user id username',
  userAdded: 'Пользователь добавлен',
  noUsers: 'Нет пользователей',
  noTasks: 'Нет задач',
  alreadyRegistered: 'Вы уже зарегистрированы',
  registrationSuccess: 'Регистрация успешна',
  statusUpdated: 'Статус задачи обновлён.',
  chooseGroup: 'Выберите группу',
  chooseTask: 'Выберите задачу',
  menuPrompt: 'Выберите действие',
  privateToken: 'Кнопка отправлена вам в личные сообщения',
  taskCompleted: 'Задача отмечена как выполненная',
  taskAccepted: 'Задача принята в работу',
  taskCanceled: 'Задача отменена',
  taskCancelForbidden:
    'Статус «Отменена» может установить только создатель задачи.',
  requestCancelExecutorOnly:
    'Отменить заявку могут только исполнитель или создатель.',
  taskHistoryEmpty: 'История изменений отсутствует.',
  taskHistoryPopupError: 'Не удалось загрузить историю задачи.',
  cancelRequestPrompt:
    'Отправьте причину удаления задачи личным сообщением боту.',
  cancelRequestStartError:
    'Не удалось отправить запрос на отмену. Напишите боту в личные сообщения.',
  cancelRequestCreatorMissing:
    'Не удалось определить автора задачи для назначения запроса.',
  cancelRequestUnavailable:
    'Запрос на отмену можно создать только для задач.',
  cancelRequestReasonLength:
    'Причина удаления должна содержать не менее 50 символов.',
  cancelRequestConfirmPrompt:
    'Проверьте текст причины удаления и подтвердите отправку запроса.',
  cancelRequestCanceled: 'Создание запроса на отмену отменено.',
  cancelRequestSuccess: 'Запрос на отмену задачи создан.',
  cancelRequestFailed: 'Не удалось создать запрос на отмену задачи.',
  enterComment: 'Введите комментарий',
  commentStartError:
    'Не удалось начать ввод комментария. Напишите боту в личные сообщения.',
  commentPromptSent: 'Отправьте комментарий в ответ на это сообщение.',
  commentSaved: 'Комментарий сохранён.',
  commentSaveError: 'Не удалось сохранить комментарий.',
  taskDeleted: 'Задача удалена',
  taskForm: 'Поля новой задачи:',
  fullMapLink: 'Полная ссылка',
  mapCoords: 'Координаты',
  mapLinkError: 'Не удалось получить ссылку',
  ermLink: 'Ссылка на приложение: https://agromarket.up.railway.app',
  help: `Доступные команды:\n/start - запуск бота\n/register - регистрация`,
  noVehicles: 'Транспорт отсутствует',
  vehiclesError: 'Не удалось загрузить транспорт',
  taskStatusPrompt: 'Подтвердите изменение статуса',
  taskStatusCanceled: 'Изменение статуса отменено',
  taskStatusInvalidId: 'Некорректный идентификатор задачи',
  taskStatusUnknownUser: 'Не удалось определить пользователя',
  taskNotFound: 'Задача не найдена',
  taskPermissionError: 'Ошибка проверки прав',
  taskAssignmentRequired: 'Вы не назначены на эту задачу',
  taskStatusUpdateError: 'Ошибка обновления статуса задачи',
  taskCompletedLock:
    'Задача уже выполнена. Изменение статуса доступно только через веб-интерфейс после отмены.',
} as const;

export default messages;
