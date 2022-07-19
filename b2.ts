async function stat(path: string): Promise<Deno.FileInfo | null> {
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

export interface DownloadOptions {
  signal?: AbortSignal;
}

export async function downloadFromB2(
  url: string,
  path: string,
  { signal }: DownloadOptions = {},
): Promise<boolean> {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const remoteMtime = mtimeFromB2Headers(res.headers) ?? Infinity;
  const localMtime = mtimeFromFileInfo(await stat(path)) ?? -Infinity;
  if (remoteMtime <= localMtime) {
    return false;
  }
  const tempFile = await Deno.makeTempFile();
  try {
    const { writable } = await Deno.create(tempFile);
    await res.body!.pipeTo(writable);
    const date = new Date(remoteMtime);
    await Deno.utime(tempFile, date, date);
    await Deno.rename(tempFile, path);
  } catch (e: unknown) {
    await Deno.remove(tempFile);
    throw e;
  }
  return true;
}
