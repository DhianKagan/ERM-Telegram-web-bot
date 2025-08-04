// Генерация документации Swagger/OpenAPI
// Модули: swagger-ui-express, swagger-jsdoc
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
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
  apis: ['./src/api/api.ts', './src/routes/tasks.js'],
};

const specs = swaggerJsdoc(options);

export { swaggerUi, specs };
