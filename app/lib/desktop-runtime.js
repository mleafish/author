export function shouldEnableTelemetry(globalObject = globalThis) {
  return !Boolean(globalObject?.electronAPI?.isElectron);
}

export function getDeferredBootstrapDelay() {
  return 1500;
}
