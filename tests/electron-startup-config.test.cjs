const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getServerWaitConfig,
  shouldLoadEnvFile,
} = require('../electron/startup-config.js');

test('skips env file loading for packaged builds', () => {
  assert.equal(shouldLoadEnvFile({ isPackaged: true }), false);
});

test('loads env file during development builds', () => {
  assert.equal(shouldLoadEnvFile({ isPackaged: false }), true);
});

test('uses a tighter packaged server wait budget', () => {
  assert.deepEqual(getServerWaitConfig({ isPackaged: true }), {
    maxRetries: 20,
    retryDelayMs: 350,
    requestTimeoutMs: 1500,
  });
});

test('keeps a more forgiving development server wait budget', () => {
  assert.deepEqual(getServerWaitConfig({ isPackaged: false }), {
    maxRetries: 30,
    retryDelayMs: 1000,
    requestTimeoutMs: 3000,
  });
});
