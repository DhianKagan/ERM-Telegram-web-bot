// Назначение файла: общие поля формы задачи для бота и веб-клиента
module.exports = [
  { name: 'title', label: 'Название', type: 'text', required: true },
  { name: 'task_type', label: 'Тип', type: 'select', options: ['Доставить', 'Купить', 'Выполнить'], default: 'Доставить' },
  { name: 'description', label: 'Описание', type: 'richtext' },
  { name: 'priority', label: 'Приоритет', type: 'select', options: ['Срочно', 'В течении дня', 'Бессрочно'], default: 'В течении дня' },
  { name: 'assignees', label: 'Исполнители', type: 'multiselect' },
  { name: 'start_location', label: 'Старт', type: 'location' },
  { name: 'end_location', label: 'Финиш', type: 'location' }
]
