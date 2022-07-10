import { normalize, resolve } from "./deps/std/path.ts";
import {
  type GetEntriesOptions,
  type Reader,
  type ReadOptions,
  WritableStreamWriter,
  ZipReader,
} from "./deps/zip.ts";

export * from "./deps/zip.ts";

export async function extractZip(
  reader: Reader,
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
      await entry.getData(new WritableStreamWriter(writable), options);
      await Deno.utime(path, entry.lastModDate, entry.lastModDate);
    }
  } finally {
    await zipReader.close();
  }
  return;
}
