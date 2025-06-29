// Генерация документации Swagger/OpenAPI
const swaggerUi = require('swagger-ui-express')
const swaggerJsdoc = require('swagger-jsdoc')

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Task Manager API',
      version: '1.0.0',
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
        },
      },
    },
  },
  apis: ['./src/api/api.js', './src/routes/tasks.js'],
}

const specs = swaggerJsdoc(options)

module.exports = {
  swaggerUi,
  specs,
}
