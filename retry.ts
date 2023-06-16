import { makeArray } from "./array.ts";
import { delay } from "./delay.ts";

export interface RetryOptions {
  timeouts?: readonly number[];
  onError?: (error: unknown, retriesLeft: number) => unknown;
  signal?: AbortSignal;
}

export async function retry<T>(
  fn: (attempts: number) => T,
  options?: RetryOptions,
): Promise<Awaited<T>> {
  const timeouts = options?.timeouts ?? createTimeouts();
  const onError = options?.onError;
  const signal = options?.signal;
  const maxRetries = timeouts.length;
  const errors: unknown[] = [];
  for (let i = 0;; i++) {
    signal?.throwIfAborted();
    try {
      return await fn(i);
    } catch (e: unknown) {
      signal?.throwIfAborted();
      onError?.(e, maxRetries - i);
      errors.push(e);
    }
    if (i < maxRetries) {
      await delay(timeouts[i], { signal });
      continue;
    }
    throw new AggregateError(errors);
  }
}

interface CreateTimeoutsOptions {
  retries?: number;
  initial?: number;
  factor?: number;
  max?: number;
}

export function createTimeouts(options?: CreateTimeoutsOptions): number[] {
  const retries = options?.retries ?? 10;
  const initial = options?.initial ?? 1000;
  const factor = options?.factor ?? 2;
  const max = options?.max ?? Infinity;
  return makeArray(retries, (i) => Math.min(initial * factor ** i, max));
}
