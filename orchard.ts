import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

export const orchardURL = "https://datasette.rhythm.cafe/rdlevels.db";

export interface Level {
  id: string;
  url: string;
  approved: boolean;
}

export function loadLevels(path: string): Map<string, Level> {
  using db = new DatabaseSync(path, { readOnly: true });
  const stmt = db.prepare(`
    select sha1, id, rdzip_url, approval
    from rdlevels
    group by sha1
    order by last_updated desc
  `);
  const levels = new Map<string, Level>();
  for (const row of stmt.iterate()) {
    const {
      "sha1": hash,
      "id": id,
      "rdzip_url": url,
      "approval": approval,
    } = row;
    assert(typeof hash === "string" && /^[0-9a-f]{40}$/.test(hash));
    assert(typeof url === "string");
    assert(typeof id === "string");
    assert(typeof approval === "number");
    assert(!levels.has(hash));
    levels.set(hash, { id, url, approved: approval >= 10 });
  }
  return levels;
}
