// Отправка SMS через GatewayAPI. Модули: https, config
const https = require('https')
const { gateway } = require('../config')

async function sendSms(number, text) {
  const data = JSON.stringify({
    sender: gateway.sender,
    message: text,
    recipients: [{ msisdn: number }]
  })
  const opts = {
    hostname: 'gatewayapi.com',
    path: '/rest/mtsms',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${gateway.key}`
    }
  }
  return new Promise((resolve, reject) => {
    const req = https.request(opts, res => {
      let body = ''
      res.on('data', ch => { body += ch })
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body)
        } else {
          reject(new Error(body))
        }
      })
    })
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

module.exports = { sendSms }
