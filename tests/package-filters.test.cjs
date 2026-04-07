const test = require('node:test');
const assert = require('node:assert/strict');

const {
  shouldCopyStandaloneEntry,
  KATEX_PUBLIC_EXCLUDES,
  ELECTRON_LANGUAGES,
} = require('../electron/package-filters.js');

test('keeps KaTeX css assets in packaged public resources', () => {
  assert.equal(shouldCopyStandaloneEntry('public/katex/katex.min.css'), true);
  assert.equal(shouldCopyStandaloneEntry('public/katex/fonts/KaTeX_Main-Regular.ttf'), true);
});

test('drops redundant KaTeX runtime assets from packaged public resources', () => {
  assert.equal(shouldCopyStandaloneEntry('public/katex/katex.js'), false);
  assert.equal(shouldCopyStandaloneEntry('public/katex/katex.mjs'), false);
  assert.equal(shouldCopyStandaloneEntry('public/katex/contrib/mhchem.js'), false);
  assert.equal(shouldCopyStandaloneEntry('public/katex/README.md'), false);
});

test('drops standalone typescript package from copied runtime modules', () => {
  assert.equal(shouldCopyStandaloneEntry('node_modules/typescript/lib/typescript.js'), false);
});

test('keeps unrelated runtime modules', () => {
  assert.equal(shouldCopyStandaloneEntry('node_modules/next/dist/server/next.js'), true);
});

test('ships only required Electron locales', () => {
  assert.deepEqual(ELECTRON_LANGUAGES, ['en-US', 'zh-CN']);
  assert.deepEqual(KATEX_PUBLIC_EXCLUDES, [
    'katex/README.md',
    'katex/katex.js',
    'katex/katex.mjs',
    'katex/katex.min.js',
    'katex/contrib/**',
  ]);
});
