// Основное приложение с навигацией и разделами
import { useState, useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import TaskList from './components/TaskList'
import TaskModal from './components/TaskModal'
import AdminPanel from './components/AdminPanel'
import LoginPage from './pages/LoginPage'
import { useAuth } from './hooks/useAuth'
import { fetchTasks, fetchUsers, createTask, updateTask } from './api/api'

function Layout() {
  const { user, signOut } = useAuth()
  const [section, setSection] = useState('tasks')
  const [tasks, setTasks] = useState([])
  const [users, setUsers] = useState([])
  const [filter, setFilter] = useState('')
  const [modal, setModal] = useState(false)
  const [current, setCurrent] = useState(null)

  const loadTasks = () => fetchTasks().then(r => setTasks(r.data))

  useEffect(() => {
    if (user) {
      loadTasks()
      if (section === 'admin') fetchUsers().then(r => setUsers(r.data))
    }
  }, [user, section])

  const saveTask = async data => {
    current ? await updateTask(current._id, data) : await createTask(data)
    setModal(false)
    loadTasks()
  }

  if (!user) return null
  const sections = [
    { id: 'tasks', title: 'Задачи', icon: '📋' },
    { id: 'projects', title: 'Проекты', icon: '📁' },
    { id: 'reports', title: 'Отчёты', icon: '📈' },
    { id: 'profile', title: 'Профиль', icon: '👤' }
  ]
  return (
    <div className="flex h-screen">
      <Sidebar sections={sections} selected={section} onSelect={setSection} isAdmin={user.role === 'admin'} />
      <main className="flex-1 p-4 overflow-y-auto">
        {section === 'tasks' && (
          <>
            <div className="flex justify-between mb-2">
              <input className="border p-1" placeholder="Поиск" value={filter} onChange={e => setFilter(e.target.value)} />
              <button onClick={() => { setCurrent(null); setModal(true) }} className="bg-blue-500 text-white px-2 rounded">+ Добавить</button>
            </div>
            <TaskList tasks={tasks} filter={filter} onSelect={t => { setCurrent(t); setModal(true) }} />
          </>
        )}
        {section === 'projects' && <div>Проекты</div>}
        {section === 'reports' && <div>Отчёты</div>}
        {section === 'profile' && <div>{user.name}</div>}
        {section === 'admin' && <AdminPanel users={users} />}
        <button onClick={signOut} className="mt-4 text-sm text-gray-500">Выйти</button>
      </main>
      {modal && <TaskModal task={current} onSave={saveTask} onClose={() => setModal(false)} />}
    </div>
  )
}

export default function App(){
  const auth=useAuth()
  return(
    <BrowserRouter>
      {!auth.user
        ? <LoginPage onSuccess={(e,p)=>auth.signIn(e,p)} />
        : <Layout />}
    </BrowserRouter>
  )
}
