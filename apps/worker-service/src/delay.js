function randomDelay(minMs, maxMs) {
  if (maxMs < minMs) {
    throw new Error('maxMs must be >= minMs');
  }
  return minMs + Math.random() * (maxMs - minMs);
}

module.exports = { randomDelay };
