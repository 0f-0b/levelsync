export interface DelayOptions {
  signal?: AbortSignal;
}

export function delay(ms: number, options?: DelayOptions): Promise<undefined> {
  return new Promise((resolve, reject) => {
    const signal = options?.signal;
    if (!signal) {
      setTimeout(resolve, ms);
      return;
    }
    signal.throwIfAborted();
    const onAbort = () => {
      reject(signal.reason);
      clearTimeout(id);
    };
    const id = setTimeout(() => {
      resolve(undefined);
      signal.removeEventListener("abort", onAbort);
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
