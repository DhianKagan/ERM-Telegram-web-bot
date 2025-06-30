#!/usr/bin/env node
// Скрипт проверки доступности API и MongoDB через fetch
require('dotenv').config()

const url = process.env.APP_URL || 'https://localhost:3000'
const jwt = require('jsonwebtoken')
const secret = process.env.JWT_SECRET

if (!secret) {
  console.error('Не задан JWT_SECRET')
  process.exit(1)
}

async function main() {
  try {
    const token = jwt.sign({ id: 0, username: 'check', isAdmin: true }, secret, { expiresIn: '1h' })

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
