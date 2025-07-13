// Тест распределения задач между транспортом
process.env.NODE_ENV='test'
process.env.BOT_TOKEN='t'
process.env.CHAT_ID='1'
process.env.JWT_SECRET='s'
process.env.MONGO_DATABASE_URL='mongodb://localhost/db'

const sample = {
  '1': {_id:'1', startCoordinates:{lat:0,lng:0}, finishCoordinates:{lat:0,lng:1}},
  '2': {_id:'2', startCoordinates:{lat:0,lng:2}, finishCoordinates:{lat:0,lng:3}},
  '3': {_id:'3', startCoordinates:{lat:0,lng:4}, finishCoordinates:{lat:0,lng:5}}
}

jest.mock('../src/db/queries', () => ({
  getTask: jest.fn(id => Promise.resolve(sample[id]))
}))

jest.mock('../src/services/route', () => ({
  trip: jest.fn(async () => ({
    trips: [{ waypoints: [{ waypoint_index: 0 }, { waypoint_index: 1 }]}]
  }))
}))

const { optimize } = require('../src/services/optimizer')
const { stopScheduler } = require('../src/services/scheduler')
const { stopQueue } = require('../src/services/messageQueue')

afterAll(() => { stopScheduler(); stopQueue() })

test('optimize распределяет задачи между машинами', async () => {
  const routes = await optimize(['1','2','3'], 2)
  expect(routes.length).toBe(2)
  const all = routes.flat()
  expect(new Set(all)).toEqual(new Set(['1','2','3']))
  expect(routes.every(r => r.length)).toBe(true)
})

test('optimize с методом trip вызывает сервис trip', async () => {
  const { trip } = require('../src/services/route')
  const routes = await optimize(['1','2'], 1, 'trip')
  expect(trip).toHaveBeenCalled()
  expect(routes[0].length).toBe(2)
})

