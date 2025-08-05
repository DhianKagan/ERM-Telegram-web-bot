// Назначение: автотесты. Модули: jest, supertest.
// Тесты маршрута /api/route и сервиса
process.env.NODE_ENV='test'
process.env.BOT_TOKEN='t'
process.env.CHAT_ID='1'
process.env.JWT_SECRET='s'
process.env.MONGO_DATABASE_URL='mongodb://localhost/db'
process.env.APP_URL='https://localhost'
process.env.ROUTING_URL='http://localhost:8000/route'

const express=require('express')
const request=require('supertest')
const { stopScheduler } = require('../src/services/scheduler')
const { stopQueue } = require('../src/services/messageQueue')

jest.mock('../src/api/middleware',()=>({ verifyToken:(_req,_res,next)=>next(), asyncHandler:fn=>fn, errorHandler:(err,_req,res,_next)=>res.status(500).json({error:err.message}) }))

const srv = require('../src/services/route')
jest.mock('../src/services/route',()=>({
  getRouteDistance: jest.fn(async()=>({ distance:100, waypoints:[] })),
  table: jest.fn(async()=>({})),
  nearest: jest.fn(async()=>({})),
  match: jest.fn(async()=>({})),
  trip: jest.fn(async()=>({}))
}))
const {
  getRouteDistance,
  table,
  nearest,
  match,
  trip
} = require('../src/services/route')

const router=require('../src/routes/route')

let app
beforeAll(()=>{
  app=express();
  app.use(express.json());
  app.use('/api/v1/route', router);
})

test('POST /api/v1/route возвращает данные маршрута', async()=>{
  const res=await request(app).post('/api/v1/route').send({ start:{lat:1,lng:2}, end:{lat:3,lng:4} })
  expect(res.body.distance).toBe(100)
  expect(Array.isArray(res.body.waypoints)).toBe(true)
  expect(getRouteDistance).toHaveBeenCalledWith({lat:1,lng:2},{lat:3,lng:4})
})

test('GET /api/v1/route/table вызывает сервис table', async()=>{
  await request(app).get('/api/v1/route/table?points=1,1;2,2')
  expect(table).toHaveBeenCalledWith('1,1;2,2',{})
})

test('GET /api/v1/route/nearest вызывает сервис nearest', async()=>{
  await request(app).get('/api/v1/route/nearest?point=1,1')
  expect(nearest).toHaveBeenCalledWith('1,1',{})
})

test('GET /api/v1/route/match вызывает сервис match', async()=>{
  await request(app).get('/api/v1/route/match?points=1,1;2,2')
  expect(match).toHaveBeenCalledWith('1,1;2,2',{})
})

test('GET /api/v1/route/trip вызывает сервис trip', async()=>{
  await request(app).get('/api/v1/route/trip?points=1,1;2,2')
  expect(trip).toHaveBeenCalledWith('1,1;2,2',{})
})

afterAll(()=>{ stopScheduler(); stopQueue() })

