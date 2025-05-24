import { dirname } from "./deps/std/path/dirname.ts";
import { join } from "./deps/std/path/join.ts";
import { normalize } from "./deps/std/path/normalize.ts";
import type { ZipReader } from "./deps/zip.ts";

// deno-lint-ignore no-control-regex
const invalidPathRE = /[\0-\x1f"*:<>?|]|^(?:\.\.)?(?:[/\\]|$)/;

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
    if (entry.directory) {
      await Deno.mkdir(path, { recursive: true });
    } else {
      await Deno.mkdir(dirname(path), { recursive: true });
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
    }
    await Deno.utime(path, entry.lastModDate, entry.lastModDate);
  }
}
