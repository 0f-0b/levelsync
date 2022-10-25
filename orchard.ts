import { DB } from "./deps/sqlite.ts";
import { assert } from "./deps/std/testing/asserts.ts";

export const orchardURL =
  "https://f000.backblazeb2.com/file/rdsqlite/backups/orchard-main.db";

export function loadLevels(path: string, codex = false): Map<string, string> {
  const db = new DB(path, { mode: "read" });
  try {
    const levels = new Map<string, string>();
    const query = db.prepareQuery(`
      select id, ${codex ? "url2" : "iif(url notnull, url, url2)"}
      from level
      group by song, authors, artist
      order by max(last_updated) desc
    `);
    try {
      for (const [id, url] of query.iter()) {
        assert(typeof id === "string");
        assert(typeof url === "string");
        assert(!levels.has(id));
        levels.set(id, url);
      }
      return levels;
    } finally {
      query.finalize();
    }
  } finally {
    db.close();
  }
}
