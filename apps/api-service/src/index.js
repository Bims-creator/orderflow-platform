const express = require('express');
const cors = require('cors');
const { createClient } = require('redis');
const { register, ordersCreatedTotal, requestMetricsMiddleware } = require('./metrics');
const { validateOrderInput } = require('./validate');

const PORT = process.env.PORT || 3000;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const app = express();
app.use(cors());
app.use(express.json());
app.use(requestMetricsMiddleware);

const redis = createClient({ url: REDIS_URL });
redis.on('error', (err) => console.error('Redis error:', err.message));

let redisReady = false;

app.get('/healthz', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/readyz', async (req, res) => {
  if (!redisReady) {
    return res.status(503).json({ status: 'not ready', reason: 'redis unavailable' });
  }
  res.json({ status: 'ready' });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.post('/orders', async (req, res) => {
  const { item, quantity } = req.body || {};
  const validation = validateOrderInput(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const id = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const order = {
    id,
    item: String(item).slice(0, 200),
    quantity,
    status: 'queued',
    createdAt: new Date().toISOString(),
  };

  const multi = redis.multi();
  multi.hSet(`order:${id}`, order);
  multi.lPush('orders:index', id);
  multi.lPush('orders:queue', JSON.stringify(order));
  await multi.exec();

  ordersCreatedTotal.inc();
  res.status(201).json(order);
});

app.get('/orders', async (req, res) => {
  const ids = await redis.lRange('orders:index', 0, 49);
  const orders = await Promise.all(ids.map((id) => redis.hGetAll(`order:${id}`)));
  res.json(orders.filter((o) => o.id));
});

app.get('/orders/:id', async (req, res) => {
  const order = await redis.hGetAll(`order:${req.params.id}`);
  if (!order.id) {
    return res.status(404).json({ error: 'order not found' });
  }
  res.json(order);
});

async function start() {
  await redis.connect();
  redisReady = true;
  app.listen(PORT, () => console.log(`api-service listening on ${PORT}`));
}

start().catch((err) => {
  console.error('Failed to start api-service:', err);
  process.exit(1);
});
