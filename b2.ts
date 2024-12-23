import { dirname } from "./deps/std/path/dirname.ts";

async function tryStat(path: string): Promise<Deno.FileInfo | null> {
  try {
    return await Deno.stat(path);
  } catch {
    return null;
  }
}

function mtimeFromFileInfo(info: Deno.FileInfo | null): number | undefined {
  return info?.mtime?.getTime();
}

function mtimeFromB2Headers(headers: Headers): number | undefined {
  const str = headers.get("x-bz-info-src_last_modified_millis") ||
    headers.get("x-bz-upload-timestamp");
  if (!str) {
    return undefined;
  }
  const time = Number(str);
  if (!Number.isFinite(time)) {
    return undefined;
  }
  return time;
}

export interface UpdateFromB2Options {
  signal?: AbortSignal;
}

export async function updateFromB2(
  url: string,
  path: string,
  options?: UpdateFromB2Options,
): Promise<boolean> {
  const res = await fetch(url, { signal: options?.signal });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const remoteMtime = mtimeFromB2Headers(res.headers) ?? Infinity;
  const localMtime = mtimeFromFileInfo(await tryStat(path)) ?? -Infinity;
  if (remoteMtime <= localMtime) {
    await res.body?.cancel();
    return false;
  }
  const tempFile = await Deno.makeTempFile({ dir: dirname(path) });
  try {
    await Deno.writeFile(tempFile, res.body ?? new Uint8Array());
    const date = new Date(remoteMtime);
    await Deno.utime(tempFile, date, date);
    await Deno.rename(tempFile, path);
  } catch (e) {
    await Deno.remove(tempFile);
    throw e;
  }
  return true;
}
