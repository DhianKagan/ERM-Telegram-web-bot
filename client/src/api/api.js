// Функции работы с backend API через Axios
import axios from 'axios'
const api = axios.create({ baseURL: '/api' })
export const login = (data) => api.post('/auth/login', data)
export const fetchTasks = () => api.get('/tasks')
export const fetchUsers = () => api.get('/users')
