import { normalize, resolve } from "./deps/std/path.ts";
import {
  type GetEntriesOptions,
  type ReadOptions,
  type SeekableReadableReader,
  ZipReader,
} from "./deps/zip.ts";

export * from "./deps/zip.ts";

export async function extractZip(
  reader: SeekableReadableReader,
  target: string,
  options?: ReadOptions & GetEntriesOptions,
): Promise<undefined> {
  const zipReader = new ZipReader(reader, options);
  try {
    for await (const entry of zipReader.getEntriesGenerator(options)) {
      const normalized = normalize(entry.filename);
      if (/:|^(?:\.\.)?(?:[/\\]|$)/.test(normalized)) {
        throw new Error(`Invalid path '${entry.filename}'`);
      }
      const path = resolve(target, normalized);
      const { writable } = await Deno.create(path);
      try {
        await entry.getData({ writable }, options);
      } catch (e: unknown) {
        await writable.close();
        throw e;
      }
      await Deno.utime(path, entry.lastModDate, entry.lastModDate);
    }
  } finally {
    await zipReader.close();
  }
  return;
}
