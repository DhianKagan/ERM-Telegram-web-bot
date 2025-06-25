#!/usr/bin/env node
// Скрипт проверки доступности API и MongoDB через fetch
require('dotenv').config()

const url = process.env.APP_URL || 'http://localhost:3000'
const email = process.env.ADMIN_EMAIL
const password = process.env.ADMIN_PASSWORD

if (!email || !password) {
  console.error('Не заданы ADMIN_EMAIL и ADMIN_PASSWORD')
  process.exit(1)
}

async function main() {
  try {
    const authRes = await fetch(`${url}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    if (!authRes.ok) throw new Error('Авторизация не удалась')
    const { token } = await authRes.json()

    const res = await fetch(`${url}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ title: 'ping' })
    })
    if (!res.ok) throw new Error(`POST /api/tasks status ${res.status}`)
    const data = await res.json()
    await fetch(`${url}/api/tasks/${data._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    console.log('База и API отвечают')
  } catch (e) {
    console.error('Ошибка:', e)
    process.exit(1)
  }
}

main()
