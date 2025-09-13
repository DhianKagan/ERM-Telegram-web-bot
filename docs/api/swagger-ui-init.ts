// Назначение: инициализация Swagger UI.
// Основные модули: window, SwaggerUIBundle
window.onload = () => {
  SwaggerUIBundle({ url: 'openapi.json', dom_id: '#swagger-ui' });
};
