const client = require('prom-client');

const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: 'api_service_' });

const httpRequestDuration = new client.Histogram({
  name: 'api_service_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [register],
});

const ordersCreatedTotal = new client.Counter({
  name: 'api_service_orders_created_total',
  help: 'Total number of orders created',
  registers: [register],
});

const httpRequestsTotal = new client.Counter({
  name: 'api_service_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

function requestMetricsMiddleware(req, res, next) {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const route = req.route ? req.route.path : req.path;
    const labels = { method: req.method, route, status_code: res.statusCode };
    end(labels);
    httpRequestsTotal.inc(labels);
  });
  next();
}

module.exports = { register, ordersCreatedTotal, requestMetricsMiddleware };
