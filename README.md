# levelsync(1)

## Name

levelsync - automatically download [Rhythm Doctor](https://rhythmdr.com/)
levels.

## Installation

Make sure you [have Deno installed](https://deno.land/#installation), and then
run the following in a terminal:

```shell
deno install -fr --unstable --allow-read --allow-write --allow-net https://cdn.jsdelivr.net/gh/0f-0b/levelsync@main/main.ts
```

## Synopsis

<pre><code><b>levelsync</b> [<i>OPTION</i>]... <i>OUTPUT</i></code></pre>

## Description

**levelsync** synchronizes the level library located at `OUTPUT` with
[rhythm.cafe](https://rhythm.cafe/), updating and removing levels as needed.

## Options

- **`-y`**, **`--yeeted`** _`PATH`_

  Archive removed levels to `PATH` instead of deleting them.

- **`-d`**, **`--database`** _`PATH`_

  Cache the level database to `PATH`. Defaults to `./orchard.db`.

- **`-c`**, **`--concurrency`** _`NUMBER`_

  Download a maximum of `NUMBER` levels simultaneously. Defaults to `1`.

- **`-n`**, **`--dry-run`**

  Show levels to be added or removed but do not actually update them.

- **`--orchard`** _`URL`_

  Download the level database from `URL`. Defaults to
  `https://codex.rhythm.cafe/orchard-main.db`.

- **`--codex`**

  Always download levels from `codex.rhythm.cafe`.

- **`-h`**, **`--help`**

  Display a summary of options and exit.

## Exit Status

The exit status is one of the following:

| Status | Meaning                                                      |
| -----: | :----------------------------------------------------------- |
|      0 | No error has occurred.                                       |
|      1 | One or more errors occurred while adding or removing levels. |
|      3 | An error occurred while updating the level database.         |
|      4 | A previous run held the lock but has not released it.        |

## Notes

You might want to schedule **levelsync** to run periodically. For example with
cron:

```crontab
0 * * * * levelsync '/path/to/Rhythm Doctor/Levels'
```

This program is pretty unstable and lacks a few key features compared to the
[original levelsync](https://github.com/huantianad/levelsync). Therefore it is
not recommended to use this program unless that one would not work for some
reason.

## See Also

- GitHub repository: <https://github.com/0f-0b/levelsync>.
