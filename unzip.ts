import { normalize } from "./deps/std/path/normalize.ts";
import { resolve } from "./deps/std/path/resolve.ts";
import type { ZipReader } from "./deps/zip.ts";

const invalidPathRE = /:|^(?:\.\.)?(?:[/\\]|$)/;

export async function extractZipInto(
  zipReader: ZipReader,
  target: string,
): Promise<undefined> {
  for await (const entry of zipReader.getEntriesGenerator()) {
    const normalized = normalize(entry.filename);
    if (invalidPathRE.test(normalized)) {
      throw new Error(`Invalid path '${entry.filename}'`);
    }
    const path = resolve(target, normalized);
    const { writable } = await Deno.open(path, {
      write: true,
      create: true,
      truncate: true,
    });
    try {
      await entry.getData(writable);
    } catch (e: unknown) {
      await writable.close();
      throw e;
    }
    await Deno.utime(path, entry.lastModDate, entry.lastModDate);
  }
}
