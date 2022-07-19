import { DB } from "./deps/sqlite.ts";
import { dedent } from "./deps/string_dedent.ts";
import { array, object, string } from "./deps/superstruct.ts";
import { downloadFromB2, type DownloadOptions } from "./b2.ts";

export async function cacheLevels(
  path: string,
  options?: DownloadOptions,
): Promise<boolean> {
  return await downloadFromB2(
    "https://codex.rhythm.cafe/orchard-main.db",
    path,
    options,
  );
}

export interface Level {
  id: string;
  url: string;
}

const LevelsQuery = array(object({
  id: string,
  url: string,
}));

export function loadLevels(path: string, codex = false): Level[] {
  const db = new DB(path, { mode: "read" });
  try {
    return LevelsQuery.create(db.queryEntries(dedent`
      select id, ${codex ? "url2" : "iif(url notnull, url, url2)"} url
      from level
      group by song, authors, artist
      order by max(last_updated) desc
    `));
  } finally {
    db.close();
  }
}
