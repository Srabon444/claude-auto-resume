const assert = require('assert');
const { parseDuration, formatRemaining, normLabel, escapeSendKeys } = require('./core');

const H = 3600000, M = 60000;
assert.strictEqual(parseDuration('5h 3m'), 5 * H + 3 * M);
assert.strictEqual(parseDuration('5h3m'), 5 * H + 3 * M);
assert.strictEqual(parseDuration('5:03'), 5 * H + 3 * M);
assert.strictEqual(parseDuration('1.5h'), 1.5 * H);
assert.strictEqual(parseDuration('90m'), 90 * M);
assert.strictEqual(parseDuration('45'), 45 * M);
assert.strictEqual(parseDuration('30s'), 30000);
assert.strictEqual(parseDuration(' 2H 10M '), 2 * H + 10 * M);
for (const bad of ['', '   ', 'abc', '5x', '0', '0h', '5:75', '5h abc', '-5m', '5h 3']) {
  assert.strictEqual(parseDuration(bad), null, `expected null for "${bad}"`);
}

assert.strictEqual(formatRemaining(5 * H + 3 * M), '5:03:00');
assert.strictEqual(formatRemaining(59000), '00:59');
assert.strictEqual(formatRemaining(1), '00:01');
assert.strictEqual(formatRemaining(-5), '00:00');

assert.strictEqual(normLabel('● Fix login'), 'Fix login');
assert.strictEqual(normLabel('Fix login'), 'Fix login');

assert.strictEqual(escapeSendKeys('continue'), 'continue');
assert.strictEqual(escapeSendKeys('a+b(c)'), 'a{+}b{(}c{)}');

console.log('core tests passed');
