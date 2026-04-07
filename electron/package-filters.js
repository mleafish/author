const KATEX_PUBLIC_EXCLUDES = [
  'katex/README.md',
  'katex/katex.js',
  'katex/katex.mjs',
  'katex/katex.min.js',
  'katex/contrib/**',
];

const ELECTRON_LANGUAGES = ['en-US', 'zh-CN'];

function normalizeEntry(entryPath) {
  return String(entryPath).replace(/\\/g, '/').replace(/^\.\//, '');
}

function shouldCopyStandaloneEntry(entryPath) {
  const normalized = normalizeEntry(entryPath);

  if (normalized.startsWith('node_modules/typescript/')) {
    return false;
  }

  if (normalized === 'public/katex/README.md') {
    return false;
  }

  if (normalized.startsWith('public/katex/contrib/')) {
    return false;
  }

  if (['public/katex/katex.js', 'public/katex/katex.mjs', 'public/katex/katex.min.js'].includes(normalized)) {
    return false;
  }

  return true;
}

module.exports = {
  shouldCopyStandaloneEntry,
  KATEX_PUBLIC_EXCLUDES,
  ELECTRON_LANGUAGES,
};
