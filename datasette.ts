import { createHash } from "node:crypto";
import { dirname } from "node:path";

import { delay } from "./delay.ts";
import { retry } from "./retry.ts";

const { min } = Math;

async function sha256sum(
  signal: AbortSignal | undefined,
  path: string,
): Promise<string> {
  const hash = createHash("sha256");
  const { readable } = await Deno.open(path);
  for await (const chunk of readable) {
    signal?.throwIfAborted();
    hash.update(chunk);
  }
  return hash.digest("hex");
}

export interface UpdateFromDatasetteOptions {
  onRetry?: (reason: unknown, attemptsLeft: number) => unknown;
  signal?: AbortSignal;
}

export async function updateFromDatasette(
  url: string,
  path: string,
  options?: UpdateFromDatasetteOptions,
): Promise<boolean> {
  const onRetry = options?.onRetry;
  const signal = options?.signal;
  const headers = new Headers();
  try {
    headers.append("if-none-match", `"${await sha256sum(signal, path)}"`);
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) {
      throw e;
    }
  }
  return await retry(async () => {
    // @ts-expect-error Deno typings are not compatible with `exactOptionalPropertyTypes` yet
    const res = await fetch(url, { headers, signal });
    if (res.status === 304) {
      return false;
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const tempFile = await Deno.makeTempFile({ dir: dirname(path) });
    try {
      if (res.body) {
        // @ts-expect-error Deno typings are not compatible with `exactOptionalPropertyTypes` yet
        await Deno.writeFile(tempFile, res.body, { signal });
      }
      await Deno.utime(tempFile, 0, 0);
      await Deno.chmod(tempFile, 0o444);
      await Deno.rename(tempFile, path);
    } catch (e) {
      await Deno.remove(tempFile);
      throw e;
    }
    return true;
  }, async (error, retries) => {
    if (retries === 10) {
      throw error;
    }
    signal?.throwIfAborted();
    onRetry?.(error, 10 - retries);
    await delay(min(2 ** retries, 600) * 1000, { signal });
  });
}
