function validateOrderInput(body) {
  const { item, quantity } = body || {};
  if (!item || typeof item !== 'string') {
    return { valid: false, error: 'item (string) is required' };
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { valid: false, error: 'quantity must be a positive integer' };
  }
  return { valid: true };
}

module.exports = { validateOrderInput };
