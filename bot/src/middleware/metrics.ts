// Назначение: сбор Prometheus-метрик HTTP запросов
// Основные модули: prom-client
const client = require('prom-client');

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Количество HTTP запросов',
  labelNames: ['method', 'path', 'status'],
});

const httpRequestDurationMs = new client.Histogram({
  name: 'http_request_duration_ms',
  help: 'Длительность HTTP запросов в мс',
  labelNames: ['method', 'path', 'status'],
  buckets: [50, 100, 300, 500, 1000, 3000, 5000],
});

function metrics(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const labels = {
      method: req.method,
      path: req.route ? req.route.path : req.path,
      status: res.statusCode,
    };
    httpRequestsTotal.inc(labels);
    httpRequestDurationMs.observe(labels, Date.now() - start);
  });
  next();
}

module.exports = metrics;
