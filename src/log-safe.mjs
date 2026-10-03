import { readFileSync, realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

// pbiplint's stderr, before the action copies it to the log, with CI log command sequences
// escaped as pbiplint itself escapes them from 0.2.4 on (packages/cli/src/log-safe.ts in
// pbiplint/pbiplint), so a run of an earlier version pinned by pbiplint-version is escaped too:
// the second # of ## before a word and [, anywhere in a line, and the first : of a line that
// starts with :: after its whitespace, each written as a \u escape. Escaping twice changes nothing
// more, since neither escape forms a sequence.

export const logSafe = (text) =>
  text
    .replace(/(?<=#)#(?=\w*\[)/g, "\\u0023")
    .replace(/^((?:[^\S\n]|\u0085)*):(?=:)/gm, "$1\\u003a");

// node src/log-safe.mjs < pbiplint.err >&2
// Node resolves the module's own URL through symbolic links, so the path it was run by is too.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href)
  process.stdout.write(logSafe(readFileSync(0, "utf8")));
