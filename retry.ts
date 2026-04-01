export async function retry<T>(
  fn: () => T,
  handleError: (error: unknown, retries: number) => unknown,
): Promise<Awaited<T>> {
  for (let i = 0;; i++) {
    try {
      return await fn();
    } catch (e) {
      await handleError(e, i);
    }
  }
}
