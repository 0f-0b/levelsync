// export * from "https://deno.land/std@0.148.0/async/delay.ts";

export interface DelayOptions {
  signal?: AbortSignal;
}

export function delay(ms: number, options?: DelayOptions): Promise<undefined> {
  const signal = options?.signal;
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const abort = () => {
      reject(signal!.reason);
      clearTimeout(id);
    };
    const id = setTimeout(() => {
      resolve(undefined);
      signal?.removeEventListener("abort", abort);
    }, ms);
    signal?.addEventListener("abort", abort, { once: true });
  });
}
