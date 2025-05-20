import { DatabaseSync } from "node:sqlite";
import { assert } from "./deps/std/assert/assert.ts";

DatabaseSync.prototype[Symbol.dispose] = function () {
  try {
    this.close();
  } catch {
    // ignored
  }
};

export const orchardURL =
  "https://f000.backblazeb2.com/file/rdsqlite/backups/orchard-main.db";

export interface Level {
  originalURL: string | null;
  codexURL: string;
}

export function loadLevels(path: string): Map<string, Level> {
  using db = new DatabaseSync(path, { readOnly: true });
  const stmt = db.prepare(`
    select id, url, url2
    from level
    group by song, authors, artist
    order by max(last_updated) desc
  `);
  const levels = new Map<string, Level>();
  for (const row of stmt.iterate()) {
    const { "id": id, "url": originalURL, "url2": codexURL } = row;
    assert(typeof id === "string");
    assert(typeof originalURL === "string" || originalURL === null);
    assert(typeof codexURL === "string");
    assert(!levels.has(id));
    levels.set(id, { originalURL, codexURL });
  }
  return levels;
}
