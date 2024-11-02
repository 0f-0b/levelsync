#!/usr/bin/env -S deno run --allow-import=deno.land:443,jsr.io:443 --allow-read --allow-write --allow-net

import { Command, ValidationError } from "./deps/cliffy/command.ts";
import { AsyncSemaphore } from "./deps/esfx/async_semaphore.ts";
import { resolve } from "./deps/std/path/resolve.ts";
import { HttpReader, terminateWorkers, ZipReader } from "./deps/zip.ts";

import { updateFromB2 } from "./b2.ts";
import { signal } from "./interrupt_signal.ts";
import { log } from "./log.ts";
import { loadLevels, orchardURL } from "./orchard.ts";
import { retry } from "./retry.ts";
import { extractZipInto } from "./unzip.ts";

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
    const parse = URL.parse(value);
    if (!parse) {
      throw new ValidationError(
        `${label} "${name}" must be a URL, but got "${value}".`,
      );
    }
    return parse.href;
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
    { default: orchardURL },
  )
  .option(
    "--codex",
    "Download levels from codex.rhythm.cafe.",
  )
  .arguments("<output:file>")
  .error((error, cmd) => {
    cmd.showHelp();
    console.error(
      "%cerror%c:",
      "color: red; font-weight: bold",
      "",
      error.message,
    );
    Deno.exit(2);
  })
  .parse();
Deno.mkdirSync(output, { recursive: true });
const lock = resolve(output, ".levelsync.lock");
try {
  Deno.writeTextFileSync(lock, `${Deno.pid}`, { createNew: true });
} catch (e: unknown) {
  if (!(e instanceof Deno.errors.AlreadyExists)) {
    throw e;
  }
  let pid: number | undefined;
  try {
    const text = Deno.readTextFileSync(lock);
    if (/^\d+$/.test(text)) {
      pid = Number(text);
    }
  } catch {
    // ignored
  }
  log.warn(
    `Another instance of levelsync${
      pid === undefined ? "" : ` (pid ${pid})`
    } is already running or was erroneously terminated. Manually remove '${lock}' to continue anyway.`,
  );
  Deno.exit(4);
}
addEventListener("unload", () => Deno.removeSync(lock));
const toAdd = await (async () => {
  try {
    await retry(() => updateFromB2(orchard, database, { signal }), {
      onError: (e, n) => {
        if (n === 0) {
          throw e;
        }
        log.warn(`Cannot update level database (${n} retries left): ${e}`);
      },
      signal,
    });
    return loadLevels(database);
  } catch (e: unknown) {
    log.error(`Cannot update level database: ${e}`);
    Deno.exit(3);
  }
})();
const toRemove = new Set<string>();
let error = false;
try {
  for await (const { name: id } of Deno.readDir(output)) {
    try {
      await Deno.stat(resolve(output, id, ".levelsync"));
    } catch {
      continue;
    }
    if (!toAdd.delete(id)) {
      toRemove.add(id);
    }
  }
} catch (e: unknown) {
  log.error(`Cannot read existing levels: ${e}`);
  Deno.exit(3);
}
if (
  !dryRun && toRemove.size >= 20 &&
  !confirm(`About to remove ${toRemove.size} levels. Continue?`)
) {
  log.warn(`Refusing to remove ${toRemove.size} levels.`);
  Deno.exit(3);
}
for (const id of toRemove) {
  log.step("Remove", id);
  if (dryRun) {
    continue;
  }
  try {
    if (yeeted !== undefined) {
      await Deno.mkdir(yeeted, { recursive: true });
      await Deno.remove(resolve(output, id, ".levelsync"));
      await Deno.rename(resolve(output, id), resolve(yeeted, id));
    } else {
      await Deno.remove(resolve(output, id), { recursive: true });
    }
  } catch (e: unknown) {
    log.error(`Cannot remove ${id}: ${e}`);
    error = true;
  }
}
const semaphore = new AsyncSemaphore(concurrency);
try {
  await Promise.all(
    Array.from(toAdd, async ([id, { originalURL, codexURL }]) => {
      let fallback: boolean;
      let url: string;
      if (codex || originalURL === null) {
        fallback = true;
        url = codexURL;
      } else {
        fallback = false;
        url = originalURL;
      }
      let started = false;
      try {
        await retry(async (attempts) => {
          await semaphore.wait();
          try {
            signal?.throwIfAborted();
            if (attempts === 0) {
              log.step("Download", `${id} (${url})`);
              started = true;
            }
            if (dryRun) {
              return;
            }
            const tempDir = await Deno.makeTempDir();
            try {
              (await Deno.open(resolve(tempDir, ".levelsync"), {
                write: true,
                create: true,
                truncate: true,
              })).close();
              const zipReader = new ZipReader(
                new HttpReader(url, { preventHeadRequest: true, signal }),
                { signal },
              );
              try {
                await extractZipInto(zipReader, tempDir);
              } finally {
                await zipReader.close();
              }
              await Deno.rename(tempDir, resolve(output, id));
            } catch (e: unknown) {
              await Deno.remove(tempDir, { recursive: true });
              throw e;
            }
          } finally {
            semaphore.release();
          }
        }, {
          onError: (e, n) => {
            if (n === 0) {
              throw e;
            }
            if (
              !fallback && e instanceof Error &&
              (e.message === "HTTP error Forbidden" ||
                e.message === "HTTP error Not Found")
            ) {
              e = new Error(
                `The original file has been deleted. Will retry with '${codexURL}'.`,
              );
              fallback = true;
              url = codexURL;
            }
            log.warn(`Cannot download ${id} (${n} retries left): ${e}`);
          },
          signal,
        });
      } catch (e: unknown) {
        if (started) {
          log.error(`Cannot download ${id}: ${e}`);
        }
        error = true;
      }
    }),
  );
} finally {
  await terminateWorkers();
}
if (error) {
  Deno.exit(1);
}
