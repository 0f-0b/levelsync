#!/usr/bin/env -S deno run --allow-import=jsr.io:443 --allow-read --allow-write --allow-net

import { Command, ValidationError } from "./deps/cliffy/command.ts";
import { AsyncSemaphore } from "./deps/esfx/async_semaphore.ts";
import { join } from "./deps/std/path/join.ts";
import { HttpReader, terminateWorkers, ZipReader } from "./deps/zip.ts";

import { updateFromB2 } from "./b2.ts";
import { signal } from "./interrupt_signal.ts";
import { log } from "./log.ts";
import { loadLevels, orchardURL } from "./orchard.ts";
import { retry } from "./retry.ts";
import { checkZip, writeEntry } from "./unzip.ts";

const {
  options: {
    yeeted,
    database,
    concurrency,
    maxFiles,
    maxSize,
    dryRun,
    orchard,
    codex,
  },
  args: [output],
} = await new Command()
  .name("levelsync")
  .usage("[options] <output>")
  .description(`
    Automatically download Rhythm Doctor levels.
  `)
  .type("positive-integer", ({ label, name, value }) => {
    if (!/^0*[1-9]\d*$/.test(value)) {
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
    "--max-files <number:positive-integer>",
    "Limit on the number of files in each level.",
    { default: 10000 },
  )
  .option(
    "--max-size <bytes:positive-integer>",
    "Limit on the uncompressed size of each level.",
    { default: 500000000 },
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
const lock = join(output, ".levelsync.lock");
try {
  Deno.writeTextFileSync(lock, `${Deno.pid}`, { createNew: true });
} catch (e) {
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
  } catch (e) {
    log.error(`Cannot update level database: ${e}`);
    Deno.exit(3);
  }
})();
const toRemove = new Set<string>();
let error = false;
try {
  for await (const { name: id } of Deno.readDir(output)) {
    try {
      await Deno.stat(join(output, id, ".levelsync"));
    } catch {
      continue;
    }
    if (!toAdd.delete(id)) {
      toRemove.add(id);
    }
  }
} catch (e) {
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
      await Deno.remove(join(output, id, ".levelsync"));
      await Deno.rename(join(output, id), join(yeeted, id));
    } else {
      await Deno.remove(join(output, id), { recursive: true });
    }
  } catch (e) {
    log.error(`Cannot remove ${id}: ${e}`);
    error = true;
  }
}
let maxFilesHelp = " (consider raising the limit using the --max-files option)";
let maxSizeHelp = " (consider raising the limit using the --max-size option)";
// deno-lint-ignore no-control-regex
const invalidFilenameRE = /[\0-\x1f"*:<>?|/\\]|^\.{0,2}$/;
const semaphore = new AsyncSemaphore(concurrency);
try {
  await Promise.all(
    Array.from(toAdd, async ([id, { originalURL, codexURL }]) => {
      if (invalidFilenameRE.test(id)) {
        log.warn(`Invalid level ID ${id}.`);
        return;
      }
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
            const zipReader = new ZipReader(
              new HttpReader(url, { preventHeadRequest: true, signal }),
              { signal },
            );
            try {
              const result = await checkZip(zipReader, {
                fileCount: maxFiles,
                uncompressedSize: maxSize,
              });
              if (result.error !== null) {
                switch (result.error) {
                  case "file-count":
                    log.warn(
                      `Refusing to download ${id}: Number of files (${result.fileCount}) exceeds limit${maxFilesHelp}`,
                    );
                    maxFilesHelp = "";
                    break;
                  case "uncompressed-size":
                    log.warn(
                      `Refusing to download ${id}: Uncompressed size (${result.uncompressedSize} bytes) exceeds limit${maxSizeHelp}`,
                    );
                    maxSizeHelp = "";
                    break;
                  case "name":
                    log.warn(
                      `Refusing to download ${id}: Invalid filename '${result.name}'`,
                    );
                    break;
                }
                return;
              }
              const tempDir = await Deno.makeTempDir({
                dir: output,
                prefix: id,
              });
              try {
                (await Deno.open(join(tempDir, ".levelsync"), {
                  write: true,
                  create: true,
                  truncate: true,
                })).close();
                for (const { name, entry } of result.checkedEntries) {
                  await writeEntry(join(tempDir, name), entry);
                }
                if (Deno.build.os !== "windows") {
                  await Deno.chmod(tempDir, 0o755);
                }
                await Deno.rename(tempDir, join(output, id));
              } catch (e) {
                await Deno.remove(tempDir, { recursive: true });
                throw e;
              }
            } finally {
              await zipReader.close();
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
      } catch (e) {
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
