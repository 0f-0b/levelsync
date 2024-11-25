import { join } from "./deps/std/path/join.ts";
import { normalize } from "./deps/std/path/normalize.ts";
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
    const path = join(target, normalized);
    const { writable } = await Deno.open(path, {
      write: true,
      create: true,
      truncate: true,
    });
    try {
      await entry.getData(writable);
    } catch (e) {
      await writable.close();
      throw e;
    }
    await Deno.utime(path, entry.lastModDate, entry.lastModDate);
  }
}
