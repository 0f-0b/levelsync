#!/usr/bin/env -S deno run --unstable --allow-read --allow-write --allow-net

import { Command, ValidationError } from "./deps/cliffy/command.ts";
import { resolve } from "./deps/std/path.ts";
import { HttpReader, terminateWorkers, ZipReader } from "./deps/zip.ts";

import { downloadFromB2 } from "./b2.ts";
import { associateBy } from "./collections/associate_by.ts";
import { signal } from "./interrupt_signal.ts";
import { log } from "./log.ts";
import { loadLevels } from "./orchard.ts";
import { pool } from "./pool.ts";
import { retry } from "./retry.ts";
import { extractZipInto } from "./zip.ts";

const {
  options: { yeeted, database, concurrency, dryRun, orchard, codex },
  args: [output],
} = await new Command()
  .name("levelsync")
  .usage("[options] <output>")
  .description(`
    Automatically download Rhythm Doctor levels.
  `)
  .type("positive-integer", ({ label, name, value }) => {
    if (!/^[1-9]\d*$/.test(value)) {
      throw new ValidationError(
        `${label} "${name}" must be a positive integer, but got "${value}".`,
      );
    }
    return Number(value);
  })
  .type("url", ({ label, name, value }) => {
    try {
      return new URL(value).href;
    } catch {
      throw new ValidationError(
        `${label} "${name}" must be a URL, but got "${value}".`,
      );
    }
  })
  .option(
    "-y, --yeeted <path:file>",
    "Path of where to store removed levels.",
  )
  .option(
    "-d, --database <path:file>",
    "Path of where to cache the level database.",
    { default: "./orchard.db" },
  )
  .option(
    "-c, --concurrency <number:positive-integer>",
    "Number of levels to download concurrently.",
    { default: 1 },
  )
  .option(
    "-n, --dry-run",
    "Do not actually add or remove levels.",
  )
  .option(
    "--orchard <url:url>",
    "URL of the level database.",
    { default: "https://codex.rhythm.cafe/orchard-main.db" },
  )
  .option(
    "--codex",
    "Download levels from codex.rhythm.cafe.",
  )
  .arguments("<output:file>")
  .parse();
Deno.mkdirSync(output, { recursive: true });
const lock = resolve(output, ".levelsync.lock");
try {
  Deno.openSync(lock, { write: true, createNew: true }).close();
} catch {
  log.warn(
    `Another instance of levelsync is already running or was erroneously terminated. Manually remove '${lock}' to continue anyway.`,
  );
  Deno.exit(4);
}
addEventListener("unload", () => Deno.removeSync(lock));
const levels = await (async () => {
  try {
    await retry((signal) => downloadFromB2(orchard, database, { signal }), {
      onError: (e, n) => {
        if (n === 0) {
          throw e;
        }
        log.warn(`Cannot update level database (${n} retries left):`, e);
      },
      signal,
    });
    return loadLevels(database, codex);
  } catch (e: unknown) {
    log.error("Cannot update level database:", e);
    Deno.exit(3);
  }
})();
let error = false;
const added = associateBy(levels, ({ id }) => id);
try {
  for await (const { name: id } of Deno.readDir(output)) {
    try {
      await Deno.stat(resolve(output, id, ".levelsync"));
    } catch {
      continue;
    }
    if (!added.delete(id)) {
      log.step("Remove", id);
      if (!dryRun) {
        try {
          if (yeeted !== undefined) {
            await Deno.mkdir(yeeted, { recursive: true });
            await Deno.remove(resolve(output, id, ".levelsync"));
            await Deno.rename(resolve(output, id), resolve(yeeted, id));
          } else {
            await Deno.remove(resolve(output, id), { recursive: true });
          }
        } catch (e: unknown) {
          log.error(`Cannot remove ${id}:`, e);
          error = true;
        }
      }
    }
  }
} catch (e: unknown) {
  log.error("Cannot read existing levels:", e);
  Deno.exit(3);
}
try {
  await pool(
    concurrency,
    (function* () {
      for (const { id, url } of added.values()) {
        yield async (signal?: AbortSignal) => {
          signal?.throwIfAborted();
          log.step("Download", `${id} (${url})`);
          if (!dryRun) {
            try {
              await retry(async (signal) => {
                const tempDir = await Deno.makeTempDir();
                try {
                  (await Deno.create(resolve(tempDir, ".levelsync"))).close();
                  const zipReader = new ZipReader(
                    new HttpReader(url, { preventHeadRequest: true, signal }),
                    { signal },
                  );
                  try {
                    await extractZipInto(zipReader, tempDir);
                  } finally {
                    zipReader.close();
                  }
                  await Deno.rename(tempDir, resolve(output, id));
                } catch (e: unknown) {
                  await Deno.remove(tempDir, { recursive: true });
                  throw e;
                }
              }, {
                onError: (e, n) => {
                  if (n === 0) {
                    throw e;
                  }
                  log.warn(`Cannot download ${id} (${n} retries left):`, e);
                },
                signal,
              });
            } catch (e: unknown) {
              log.error(`Cannot download ${id}:`, e);
              error = true;
            }
          }
        };
      }
    })(),
    { signal },
  );
} catch {
  // ignored
} finally {
  terminateWorkers();
}
if (error) {
  Deno.exit(1);
}
