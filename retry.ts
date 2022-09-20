import { delay } from "./delay.ts";

export interface RetryOptions {
  retries?: number;
  interval?: number;
  onError?: (error: unknown, retries: number) => unknown;
  signal?: AbortSignal;
}

export async function retry<T>(
  fn: (signal?: AbortSignal) => T,
  { retries = 10, interval = 1000, onError, signal }: RetryOptions = {},
): Promise<Awaited<T>> {
  const errors: unknown[] = [];
  for (;;) {
    signal?.throwIfAborted();
    try {
      return await fn(signal);
    } catch (e) {
      onError?.(e, retries);
      errors.push(e);
    }
    if (--retries < 0) {
      break;
    }
    await delay(interval, { signal });
  }
  throw new AggregateError(errors);
}
