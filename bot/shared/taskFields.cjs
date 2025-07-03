// Назначение файла: общие поля формы задачи для бота и веб-клиента
module.exports = [
  { name: 'title', label: 'Название', type: 'text', required: true },
  {
    name: 'task_type',
    label: 'Тип',
    type: 'select',
    options: ['Доставить', 'Купить', 'Выполнить'],
    default: 'Доставить'
  },
  {
    name: 'priority',
    label: 'Приоритет',
    type: 'select',
    options: ['Срочно', 'В течении дня', 'Бессрочно'],
    default: 'В течении дня'
  },
  { name: 'department', label: 'Отдел', type: 'select' },
  { name: 'creator', label: 'Задачу создал', type: 'select' },
  { name: 'assignees', label: 'Исполнители', type: 'multiselect' },
  { name: 'start_location', label: 'Старт точка', type: 'location' },
  { name: 'end_location', label: 'Финальная точка', type: 'location' },
  { name: 'description', label: '🔨 Задача', type: 'richtext' },
  { name: 'comment', label: 'Комментарий', type: 'richtext' }
]
