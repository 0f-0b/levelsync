import { delay } from "./deps/std/async/delay.ts";

export interface RetryOptions {
  retries?: number;
  interval?: number;
  signal?: AbortSignal;
}

export async function retry<T>(
  fn: (signal?: AbortSignal) => T,
  { retries = 10, interval = 1000, signal }: RetryOptions = {},
): Promise<Awaited<T>> {
  const errors: unknown[] = [];
  for (;;) {
    signal?.throwIfAborted();
    try {
      return await fn(signal);
    } catch (e: unknown) {
      errors.push(e);
    }
    if (retries-- <= 0) {
      break;
    }
    await delay(interval, { signal });
  }
  throw new AggregateError(errors);
}
