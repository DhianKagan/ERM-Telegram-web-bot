// Тест функции createRouteLink
process.env.BOT_TOKEN='t'
process.env.CHAT_ID='1'
process.env.MONGO_DATABASE_URL='mongodb://localhost/db'
process.env.JWT_SECRET='s'
process.env.APP_URL='https://localhost'

const { generateRouteLink } = require('../src/services/maps')
const { stopScheduler } = require('../src/services/scheduler')
const { stopQueue } = require('../src/services/messageQueue')

test('generateRouteLink формирует корректный url', ()=>{
  const url=generateRouteLink({lat:1,lng:2},{lat:3,lng:4})
  expect(url).toBe('https://www.google.com/maps/dir/?api=1&origin=1,2&destination=3,4&travelmode=driving')
})

afterAll(()=>{ stopScheduler(); stopQueue() })
