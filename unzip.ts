import { dirname, normalize } from "node:path";
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
  const checkedEntries: CheckedEntry[] = [];
  let fileCount = 0;
  let uncompressedSize = 0;
  for await (const entry of zipReader.getEntriesGenerator()) {
    if (checkedEntries.length < limits.fileCount) {
      const normalized = normalize(entry.filename);
      if (invalidPathRE.test(normalized)) {
        return { error: "name", name: entry.filename };
      }
      checkedEntries.push({ name: normalized, entry });
    }
    fileCount++;
    uncompressedSize += entry.uncompressedSize;
  }
  if (fileCount > limits.fileCount) {
    return { error: "file-count", fileCount };
  }
  if (uncompressedSize > limits.uncompressedSize) {
    return { error: "uncompressed-size", uncompressedSize };
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
