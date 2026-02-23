import { dirname } from "./deps/std/path/dirname.ts";
import { normalize } from "./deps/std/path/normalize.ts";
import type { ReadableEntry, ZipReader } from "./deps/zip_js.ts";

// deno-lint-ignore no-control-regex
const invalidPathRE = /[\0-\x1f"*:<>?|]|^(?:\.\.)?(?:[/\\]|$)/;

export interface Limits {
  fileCount: number;
  uncompressedSize: number;
}

export interface CheckedEntry {
  name: string;
  entry: ReadableEntry;
}

export type CheckResult =
  | { error: null; checkedEntries: CheckedEntry[] }
  | { error: "file-count"; fileCount: number }
  | { error: "uncompressed-size"; uncompressedSize: number }
  | { error: "name"; name: string };

export async function checkZip(
  zipReader: ZipReader,
  limits: Limits,
): Promise<CheckResult> {
  const entries = await zipReader.getEntries();
  const fileCount = entries.length;
  if (fileCount > limits.fileCount) {
    return { error: "file-count", fileCount };
  }
  let uncompressedSize = 0;
  for (const entry of entries) {
    uncompressedSize += entry.uncompressedSize;
  }
  if (uncompressedSize > limits.uncompressedSize) {
    return { error: "uncompressed-size", uncompressedSize };
  }
  const checkedEntries: CheckedEntry[] = [];
  for (const entry of entries) {
    const normalized = normalize(entry.filename);
    if (invalidPathRE.test(normalized)) {
      return { error: "name", name: entry.filename };
    }
    checkedEntries.push({ name: normalized, entry });
  }
  return { error: null, checkedEntries };
}

export async function writeEntry(
  path: string,
  entry: ReadableEntry,
): Promise<undefined> {
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
