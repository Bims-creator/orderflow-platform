const client = require('prom-client');

const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: 'worker_service_' });

const ordersProcessedTotal = new client.Counter({
  name: 'worker_service_orders_processed_total',
  help: 'Total number of orders processed',
  registers: [register],
});

const orderProcessingDuration = new client.Histogram({
  name: 'worker_service_order_processing_duration_seconds',
  help: 'Time spent processing an order in seconds',
  buckets: [0.1, 0.3, 0.5, 1, 2, 3, 5, 8],
  registers: [register],
});

const queueDepthGauge = new client.Gauge({
  name: 'worker_service_queue_depth',
  help: 'Current number of orders waiting in the queue',
  registers: [register],
});

module.exports = { register, ordersProcessedTotal, orderProcessingDuration, queueDepthGauge };
