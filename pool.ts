export interface PoolOptions {
  signal?: AbortSignal;
}

export async function pool(
  concurrency: number,
  fns:
    | Iterable<(signal?: AbortSignal) => unknown>
    | AsyncIterable<(signal?: AbortSignal) => unknown>,
  { signal }: PoolOptions = {},
): Promise<undefined> {
  const executing = new Set<Promise<unknown>>();
  try {
    for await (const fn of fns) {
      signal?.throwIfAborted();
      const promise = (async () => {
        await fn(signal);
        // @ts-expect-error promise is always initialized here
        executing.delete(promise);
      })();
      executing.add(promise);
      if (executing.size >= concurrency) {
        await Promise.race(executing);
      }
    }
    await Promise.all(executing);
  } catch {
    const errors: unknown[] = [];
    for (const result of await Promise.allSettled(executing)) {
      if (result.status === "rejected") {
        errors.push(result.reason);
      }
    }
    throw new AggregateError(errors);
  }
  return;
}
