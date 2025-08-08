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
      responses: {
        Problem: {
          description: 'Ошибка RFC 9457',
          content: {
            'application/problem+json': {
              schema: {
                type: 'object',
                required: ['type', 'title', 'status', 'instance'],
                properties: {
                  type: { type: 'string', format: 'uri' },
                  title: { type: 'string' },
                  status: { type: 'integer' },
                  detail: { type: 'string' },
                  instance: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  },
  apis: ['./src/api/api.ts', './src/routes/tasks.ts'],
};

const specs = swaggerJsdoc(options);

export { swaggerUi, specs };
