const APP_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0']);
const EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

function parseUrl(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function isAppUrl(url) {
  if (url === 'about:blank') {
    return true;
  }

  const parsed = parseUrl(url);
  if (!parsed) {
    return false;
  }

  return ['http:', 'https:'].includes(parsed.protocol) && APP_HOSTS.has(parsed.hostname);
}

function shouldOpenExternally(url) {
  const parsed = parseUrl(url);
  if (!parsed) {
    return false;
  }

  if (!EXTERNAL_PROTOCOLS.has(parsed.protocol)) {
    return false;
  }

  return !isAppUrl(url);
}

function shouldBlockNavigation(url) {
  return !isAppUrl(url);
}

module.exports = {
  APP_HOSTS,
  isAppUrl,
  shouldOpenExternally,
  shouldBlockNavigation,
};
