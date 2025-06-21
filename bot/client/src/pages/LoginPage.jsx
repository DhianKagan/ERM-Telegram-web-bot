// Страница входа
import { useState } from 'react'
export default function LoginPage({ onSuccess }){
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [error,setError]=useState('')
  const submit=async e=>{e.preventDefault();try{await onSuccess(email,password)}catch{setError('Ошибка')}}
  return(
    <form onSubmit={submit} className="flex flex-col gap-2 p-6">
      <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" className="border p-2" />
      <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Пароль" className="border p-2" />
      {error && <div className="text-red-500">{error}</div>}
      <button className="bg-blue-500 text-white p-2 rounded">Войти</button>
    </form>
  )
}
