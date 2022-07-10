import { DB } from "./deps/sqlite.ts";
import { dedent } from "./deps/string_dedent.ts";
import {
  array,
  boolean,
  coerce,
  enums,
  integer,
  nullable,
  number,
  object,
  string,
  type Struct,
  tuple,
} from "./deps/superstruct.ts";

async function stat(path: string): Promise<Deno.FileInfo | null> {
  try {
    return await Deno.stat(path);
  } catch {
    return null;
  }
}

function mtimeFromFileInfo(info: Deno.FileInfo | null): number | undefined {
  return info?.mtime?.getTime();
}

function mtimeFromB2Headers(headers: Headers): number | undefined {
  const str = headers.get("x-bz-info-src_last_modified_millis") ||
    headers.get("x-bz-upload-timestamp");
  if (!str) {
    return undefined;
  }
  const time = Number(str);
  if (!Number.isFinite(time)) {
    return undefined;
  }
  return time;
}

interface DownloadOptions {
  signal?: AbortSignal;
}

async function downloadFromB2(
  url: string,
  path: string,
  { signal }: DownloadOptions = {},
): Promise<boolean> {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const remoteMtime = mtimeFromB2Headers(res.headers) ?? Infinity;
  const localMtime = mtimeFromFileInfo(await stat(path)) ?? -Infinity;
  if (remoteMtime <= localMtime) {
    return false;
  }
  const tempFile = await Deno.makeTempFile();
  try {
    const { writable } = await Deno.create(tempFile);
    await res.body!.pipeTo(writable);
    const date = new Date(remoteMtime);
    await Deno.utime(tempFile, date, date);
    await Deno.rename(tempFile, path);
  } catch (e: unknown) {
    await Deno.remove(tempFile);
    throw e;
  }
  return true;
}

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

export const Difficulty = Object.freeze(
  {
    Easy: 0,
    Medium: 1,
    Tough: 2,
    VeryTough: 3,
  } as const,
);
export type Difficulty = typeof Difficulty[keyof typeof Difficulty];

export interface Level {
  id: string;
  url: string;
  canonicalURL: string;
  lastUpdated: number;
  song: string;
  artist: string;
  authors: string[];
  difficulty: Difficulty;
  description: string;
  tags: string[];
  seizureWarning: boolean;
  hue: number;
  imageURL: string;
  thumbnailURL: string;
  iconURL: string | null;
  onePlayer: boolean;
  twoPlayer: boolean;
  hasClassics: boolean;
  hasOneshots: boolean;
  hasSquareshots: boolean;
  hasFreezeshots: boolean;
  hasFreetimes: boolean;
  hasHolds: boolean;
  bpm: [number, number];
  source: string;
  sha1: string;
}

function json<T, S>(struct: Struct<T, S>): Struct<T, S> {
  return coerce(struct, string, (s) => JSON.parse(s));
}

const IntBoolean = coerce(boolean, integer, Boolean);
const LevelsQuery = array(object({
  id: string,
  url: string,
  canonicalURL: string,
  lastUpdated: coerce(integer, string, (s) => Date.parse(`${s}+08:00`)), // is this the correct timezone?
  song: string,
  artist: string,
  authors: json(array(string)),
  difficulty: enums(Object.values(Difficulty)),
  description: string,
  tags: json(array(string)),
  seizureWarning: IntBoolean,
  hue: number,
  imageURL: string,
  thumbnailURL: string,
  iconURL: nullable(string), // not actually nullable, 404's when missing
  onePlayer: IntBoolean,
  twoPlayer: IntBoolean,
  hasClassics: IntBoolean,
  hasOneshots: IntBoolean,
  hasSquareshots: IntBoolean,
  hasFreezeshots: IntBoolean,
  hasFreetimes: IntBoolean,
  hasHolds: IntBoolean,
  bpm: json(tuple([number, number])),
  source: string,
  sha1: string,
}));

export function loadLevels(path: string): Level[] {
  const db = new DB(path, { mode: "read" });
  try {
    return LevelsQuery.create(db.queryEntries(dedent`
      select
        id, url2 url, iif(url notnull, url, url2) canonicalURL,
        max(last_updated) lastUpdated, song, artist, authors, difficulty,
        description, tags, seizure_warning seizureWarning, hue,
        image imageURL, thumb thumbnailURL, icon iconURL,
        single_player onePlayer, two_player twoPlayer,
        has_classics hasClassics, has_oneshots hasOneshots,
        has_squareshots hasSquareshots, has_freezeshots hasFreezeshots,
        has_freetimes hasFreetimes, has_holds hasHolds,
        json_array(min_bpm, max_bpm) bpm, source, sha1
      from level
      group by song, authors, artist
      order by last_updated desc
    `));
  } finally {
    db.close();
  }
}

const ApprovalResponse = array(nullable(integer));

export async function getApproval(id: string): Promise<number> {
  const url = new URL("https://api.rhythm.cafe/datasette/status.json");
  url.searchParams.append("sql", "select approval from status where id = :id");
  url.searchParams.append("id", id);
  url.searchParams.append("_shape", "arrayfirst");
  const res = await fetch(url);
  const [approval] = ApprovalResponse.create(await res.json());
  return approval ?? 0;
}
