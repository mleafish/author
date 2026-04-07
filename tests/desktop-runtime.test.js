import test from 'node:test';
import assert from 'node:assert/strict';

import { getDeferredBootstrapDelay, shouldEnableTelemetry } from '../app/lib/desktop-runtime.js';

test('disables telemetry when Electron bridge is present', () => {
  assert.equal(shouldEnableTelemetry({ electronAPI: { isElectron: true } }), false);
});

test('enables telemetry in regular browser context', () => {
  assert.equal(shouldEnableTelemetry({}), true);
});

test('uses a stable deferred bootstrap delay', () => {
  assert.equal(getDeferredBootstrapDelay(), 1500);
});
