export interface DelayOptions {
  signal?: AbortSignal | undefined;
}

/** `ms` must be between 0 and 2³¹-1. */
export function delay(ms: number, options?: DelayOptions): Promise<undefined> {
  return new Promise((resolve, reject) => {
    const signal = options?.signal;
    if (!signal) {
      setTimeout(resolve as () => undefined, ms);
      return;
    }
    signal.throwIfAborted();
    const abort = () => {
      reject(signal.reason);
      clearTimeout(timer);
    };
    const timer = setTimeout(() => {
      (resolve as () => undefined)();
      signal.removeEventListener("abort", abort);
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}
