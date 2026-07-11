const test = require('node:test');
const assert = require('node:assert/strict');
const { validateOrderInput } = require('../src/validate');

test('rejects missing item', () => {
  const result = validateOrderInput({ quantity: 2 });
  assert.equal(result.valid, false);
});

test('rejects non-positive quantity', () => {
  const result = validateOrderInput({ item: 'widget', quantity: 0 });
  assert.equal(result.valid, false);
});

test('rejects non-integer quantity', () => {
  const result = validateOrderInput({ item: 'widget', quantity: 1.5 });
  assert.equal(result.valid, false);
});

test('accepts valid order', () => {
  const result = validateOrderInput({ item: 'widget', quantity: 3 });
  assert.equal(result.valid, true);
});
