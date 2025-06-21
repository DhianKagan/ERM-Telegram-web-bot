// Основное приложение с навигацией и разделами
import { useState,useEffect } from 'react'
import { BrowserRouter,Routes,Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import TaskList from './components/TaskList'
import AdminPanel from './components/AdminPanel'
import LoginPage from './pages/LoginPage'
import { useAuth } from './hooks/useAuth'
import { fetchTasks, fetchUsers } from './api/api'

function Layout(){
  const {user,signOut}=useAuth()
  const [section,setSection]=useState('tasks')
  const [tasks,setTasks]=useState([])
  const [users,setUsers]=useState([])
  useEffect(()=>{ if(user){fetchTasks().then(r=>setTasks(r.data)); if(section==='admin') fetchUsers().then(r=>setUsers(r.data))} },[user,section])
  if(!user) return null
  return(
    <div className="flex h-screen">
      <Sidebar sections={[{id:'tasks',title:'Задачи'}]} selected={section} onSelect={setSection} isAdmin={user.role==='admin'} />
      <main className="flex-1 p-4 overflow-y-auto">
        {section==='tasks'&&<TaskList tasks={tasks}/>}
        {section==='admin'&&<AdminPanel users={users}/>}
        <button onClick={signOut} className="mt-4 text-sm text-gray-500">Выйти</button>
      </main>
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
