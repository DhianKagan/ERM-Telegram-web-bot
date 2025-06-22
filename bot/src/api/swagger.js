// Настройка Swagger/OpenAPI для Express.
const swaggerUi = require('swagger-ui-express')
const swaggerJSDoc = require('swagger-jsdoc')

const options = {
  definition: {
    openapi: '3.0.0',
    info: { title: 'Task API', version: '1.0.0' },
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer' }
      }
    }
  },
  apis: ['src/api/api.js']
}

const spec = swaggerJSDoc(options)

function setup(app) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(spec))
}

module.exports = setup
