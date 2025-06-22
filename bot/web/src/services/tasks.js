// Запросы к API задач
export const fetchKanban = () =>
  fetch('/api/tasks?kanban=true', { headers:{ Authorization: localStorage.token ? `Bearer ${localStorage.token}` : '' } })
    .then(r => r.ok ? r.json() : [])

export const updateTaskStatus = (id, status) =>
  fetch(`/api/tasks/${id}`, {
    method: 'PATCH',
    headers:{ 'Content-Type':'application/json', Authorization: localStorage.token ? `Bearer ${localStorage.token}` : '' },
    body: JSON.stringify({ status })
  })
