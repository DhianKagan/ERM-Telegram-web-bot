// Тест маршрута /api/maps/expand
process.env.NODE_ENV='test'
process.env.BOT_TOKEN='t'
process.env.CHAT_ID='1'
process.env.JWT_SECRET='s'
process.env.MONGO_DATABASE_URL='mongodb://localhost/db'
process.env.APP_URL='https://localhost'

const express=require('express')
const request=require('supertest')
const { stopScheduler } = require('../src/services/scheduler')
const { stopQueue } = require('../src/services/messageQueue')

jest.mock('../src/services/maps',()=>({
  expandMapsUrl: jest.fn(async()=> 'https://maps.google.com/full'),
  extractCoords: jest.fn(()=> ({lat:1,lng:2}))
}))

jest.mock('../src/api/middleware',()=>({ verifyToken:(_req,_res,next)=>next(), asyncHandler:fn=>fn, errorHandler:(err,_req,res,_next)=>res.status(500).json({error:err.message}) }))

const router=require('../src/routes/maps')
const { expandMapsUrl } = require('../src/services/maps')

let app
beforeAll(()=>{
  app=express();
  app.use(express.json());
  app.use('/api/v1/maps', router);
})

test('POST /api/v1/maps/expand возвращает url и coords', async()=>{
  const res=await request(app).post('/api/v1/maps/expand').send({url:'u'})
  expect(res.body.url).toBe('https://maps.google.com/full')
  expect(res.body.coords).toEqual({lat:1,lng:2})
  expect(expandMapsUrl).toHaveBeenCalledWith('u')
})

afterAll(()=>{ stopScheduler(); stopQueue() })
