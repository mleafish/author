function shouldLoadEnvFile({ isPackaged }) {
  return !isPackaged;
}

function getServerWaitConfig({ isPackaged }) {
  if (isPackaged) {
    return {
      maxRetries: 20,
      retryDelayMs: 350,
      requestTimeoutMs: 1500,
    };
  }

  return {
    maxRetries: 30,
    retryDelayMs: 1000,
    requestTimeoutMs: 3000,
  };
}

module.exports = {
  getServerWaitConfig,
  shouldLoadEnvFile,
};
