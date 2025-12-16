"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.specs = exports.swaggerUi = void 0;
// Генерация документации Swagger/OpenAPI
// Модули: swagger-ui-express, swagger-jsdoc
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
exports.swaggerUi = swagger_ui_express_1.default;
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
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
    apis: ['./src/api/routes.ts', './src/routes/tasks.ts'],
};
const specs = (0, swagger_jsdoc_1.default)(options);
exports.specs = specs;
