import { DB } from "./deps/sqlite.ts";
import { assert } from "./deps/std/assert/assert.ts";

export const orchardURL =
  "https://f000.backblazeb2.com/file/rdsqlite/backups/orchard-main.db";

export interface Level {
  originalURL: string | null;
  codexURL: string;
}

export function loadLevels(path: string): Map<string, Level> {
  const db = new DB(path, { mode: "read" });
  try {
    const query = db.prepareQuery(`
      select id, url, url2
      from level
      group by song, authors, artist
      order by max(last_updated) desc
    `);
    try {
      const levels = new Map<string, Level>();
      for (const [id, originalURL, codexURL] of query.iter()) {
        assert(typeof id === "string");
        assert(typeof originalURL === "string" || originalURL === null);
        assert(typeof codexURL === "string");
        assert(!levels.has(id));
        levels.set(id, { originalURL, codexURL });
      }
      return levels;
    } finally {
      query.finalize();
    }
  } finally {
    db.close();
  }
}
