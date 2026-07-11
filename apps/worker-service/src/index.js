const express = require('express');
const { createClient } = require('redis');
const {
  register,
  ordersProcessedTotal,
  orderProcessingDuration,
  queueDepthGauge,
} = require('./metrics');
const { randomDelay } = require('./delay');

const PORT = process.env.PORT || 3003;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const MIN_PROCESSING_MS = Number(process.env.MIN_PROCESSING_MS || 200);
const MAX_PROCESSING_MS = Number(process.env.MAX_PROCESSING_MS || 1500);

const app = express();
const blockingClient = createClient({ url: REDIS_URL });
const client = createClient({ url: REDIS_URL });
blockingClient.on('error', (err) => console.error('Redis (blocking) error:', err.message));
client.on('error', (err) => console.error('Redis error:', err.message));

let ready = false;
let processing = true;

app.get('/healthz', (req, res) => res.json({ status: 'ok' }));

app.get('/readyz', (req, res) => {
  if (!ready) return res.status(503).json({ status: 'not ready' });
  res.json({ status: 'ready' });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processOrder(raw) {
  const order = JSON.parse(raw);
  const stopTimer = orderProcessingDuration.startTimer();
  const delay = randomDelay(MIN_PROCESSING_MS, MAX_PROCESSING_MS);
  await sleep(delay);

  await client.hSet(`order:${order.id}`, {
    status: 'completed',
    completedAt: new Date().toISOString(),
  });

  stopTimer();
  ordersProcessedTotal.inc();
  console.log(`processed order ${order.id} (${order.item} x${order.quantity}) in ${Math.round(delay)}ms`);
}

async function consumeLoop() {
  while (processing) {
    try {
      const result = await blockingClient.blPop('orders:queue', 5);
      if (result) {
        await processOrder(result.element);
      }
    } catch (err) {
      console.error('Error consuming queue:', err.message);
      await sleep(1000);
    }
  }
}

async function pollQueueDepth() {
  while (processing) {
    try {
      const depth = await client.lLen('orders:queue');
      queueDepthGauge.set(depth);
    } catch (err) {
      console.error('Error polling queue depth:', err.message);
    }
    await sleep(5000);
  }
}

async function start() {
  await blockingClient.connect();
  await client.connect();
  ready = true;

  app.listen(PORT, () => console.log(`worker-service listening on ${PORT}`));

  consumeLoop();
  pollQueueDepth();
}

process.on('SIGTERM', () => {
  processing = false;
  process.exit(0);
});

start().catch((err) => {
  console.error('Failed to start worker-service:', err);
  process.exit(1);
});
