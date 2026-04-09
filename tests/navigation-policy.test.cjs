const test = require('node:test');
const assert = require('node:assert/strict');

const {
  APP_HOSTS,
  isAppUrl,
  shouldOpenExternally,
  shouldBlockNavigation,
} = require('../electron/navigation-policy.js');

test('recognizes packaged app URLs as internal', () => {
  assert.deepEqual([...APP_HOSTS], ['localhost', '127.0.0.1', '0.0.0.0']);
  assert.equal(isAppUrl('http://localhost:3000/'), true);
  assert.equal(isAppUrl('http://127.0.0.1:3000/settings'), true);
  assert.equal(isAppUrl('https://0.0.0.0:3000/help'), true);
  assert.equal(isAppUrl('about:blank'), true);
});

test('treats external websites and schemes as non-app URLs', () => {
  assert.equal(isAppUrl('https://github.com/mleafish/author'), false);
  assert.equal(isAppUrl('mailto:support@example.com'), false);
  assert.equal(isAppUrl('not a url'), false);
});

test('opens true external links in the system browser', () => {
  assert.equal(shouldOpenExternally('https://github.com/mleafish/author'), true);
  assert.equal(shouldOpenExternally('mailto:support@example.com'), true);
  assert.equal(shouldOpenExternally('http://localhost:3000/'), false);
  assert.equal(shouldOpenExternally('about:blank'), false);
});

test('blocks any main-window navigation that leaves the app origin', () => {
  assert.equal(shouldBlockNavigation('https://github.com/mleafish/author'), true);
  assert.equal(shouldBlockNavigation('mailto:support@example.com'), true);
  assert.equal(shouldBlockNavigation('http://localhost:3000/'), false);
  assert.equal(shouldBlockNavigation('about:blank'), false);
});
