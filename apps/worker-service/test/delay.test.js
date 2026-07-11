const test = require('node:test');
const assert = require('node:assert/strict');
const { randomDelay } = require('../src/delay');

test('returns a value within [min, max]', () => {
  for (let i = 0; i < 50; i += 1) {
    const value = randomDelay(200, 1500);
    assert.ok(value >= 200 && value <= 1500, `expected ${value} to be within [200, 1500]`);
  }
});

test('handles min === max', () => {
  assert.equal(randomDelay(500, 500), 500);
});

test('throws when max < min', () => {
  assert.throws(() => randomDelay(1000, 100));
});
