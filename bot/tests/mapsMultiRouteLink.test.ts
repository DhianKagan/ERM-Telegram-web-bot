// Назначение: автотесты. Модули: jest, supertest.
// Тест функции generateMultiRouteLink
process.env.BOT_TOKEN='t'
process.env.CHAT_ID='1'
process.env.MONGO_DATABASE_URL='mongodb://localhost/db'
process.env.JWT_SECRET='s'
process.env.APP_URL='https://localhost'

const { generateMultiRouteLink } = require('../src/services/maps')
const { stopScheduler } = require('../src/services/scheduler')
const { stopQueue } = require('../src/services/messageQueue')

test('generateMultiRouteLink формирует корректный url', ()=>{
  const url=generateMultiRouteLink([
    {lat:1,lng:2},
    {lat:3,lng:4},
    {lat:5,lng:6}
  ])
  expect(url).toBe('https://www.google.com/maps/dir/?api=1&origin=1,2&destination=5,6&travelmode=driving&waypoints=3,4')
})

afterAll(()=>{ stopScheduler(); stopQueue() })
