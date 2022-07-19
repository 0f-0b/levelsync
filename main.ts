#!/usr/bin/env -S deno run --unstable --allow-read --allow-write --allow-net

import { Command, ValidationError } from "./deps/cliffy/command.ts";
import { bold, green, red, yellow } from "./deps/std/fmt/colors.ts";
import { resolve } from "./deps/std/path.ts";
import { associateBy } from "./collections/associate_by.ts";
import { signal } from "./interrupt_signal.ts";
import { cacheLevels, loadLevels } from "./orchard.ts";
import { pool } from "./pool.ts";
import { retry } from "./retry.ts";
import { extractZip, HttpReader, terminateWorkers } from "./zip.ts";

await new class extends Command {
  override error(e: Error): never {
    if (!(e instanceof ValidationError)) {
      throw e;
    }
    this.showHelp();
    console.error(`${bold(red("error"))}: ${e.message}`);
    Deno.exit(2);
  }
}()
  .name("levelsync")
  .usage("[options] <output>")
  .description(`
    Automatically download Rhythm Doctor levels.
  `)
  .type("positive-integer", ({ label, name, value }) => {
    const result = Number(value);
    if (!(Number.isInteger(result) && result > 0)) {
      throw new ValidationError(
        `${label} "${name}" must be a positive integer, but got "${value}".`,
      );
    }
    return result;
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
    "--codex",
    "Download levels from codex.rhythm.cafe.",
  )
  .arguments("<output:file>")
  .action(async function ({
    yeeted,
    database,
    concurrency,
    dryRun,
    codex,
  }, output) {
    Deno.mkdirSync(output, { recursive: true });
    const lock = resolve(output, ".levelsync.lock");
    try {
      Deno.openSync(lock, { write: true, createNew: true }).close();
    } catch {
      console.warn(
        `${
          yellow("Warning")
        } Another instance of levelsync is already running or was erroneously terminated. Manually remove '${lock}' to continue anyway.`,
      );
      Deno.exit(4);
    }
    addEventListener("unload", () => Deno.removeSync(lock));
    const levels = await (async () => {
      try {
        await retry((signal) => cacheLevels(database, { signal }), { signal });
        return loadLevels(database, codex);
      } catch (e: unknown) {
        console.error(
          `${bold(red("error"))}: Cannot update level database:`,
          e,
        );
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
          console.log(`${green("Remove")} ${id}`);
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
              console.error(`${bold(red("error"))}: Cannot remove ${id}:`, e);
              error = true;
            }
          }
        }
      }
    } catch (e: unknown) {
      console.error(`${bold(red("error"))}: Cannot read existing levels:`, e);
      Deno.exit(3);
    }
    try {
      await pool(
        concurrency,
        (function* () {
          for (const { id, url } of added.values()) {
            yield async (signal?: AbortSignal) => {
              signal?.throwIfAborted();
              console.log(`${green("Download")} ${id} (${url})`);
              if (!dryRun) {
                try {
                  await retry(async (signal) => {
                    const tempDir = await Deno.makeTempDir();
                    try {
                      (await Deno.create(resolve(tempDir, ".levelsync")))
                        .close();
                      const reader = new HttpReader(url, {
                        preventHeadRequest: true,
                        signal,
                      });
                      await extractZip(reader, tempDir, { signal });
                      await Deno.rename(tempDir, resolve(output, id));
                    } catch (e: unknown) {
                      await Deno.remove(tempDir, { recursive: true });
                      throw e;
                    }
                  }, { signal });
                } catch (e: unknown) {
                  console.error(
                    `${bold(red("error"))}: Cannot download ${id}:`,
                    e,
                  );
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
  })
  .parse();
