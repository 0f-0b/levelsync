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
  do {
    signal?.throwIfAborted();
    try {
      return await fn(signal);
    } catch (e: unknown) {
      errors.push(e);
    }
    await delay(interval, { signal });
  } while (retries-- > 0);
  throw new AggregateError(errors);
}
