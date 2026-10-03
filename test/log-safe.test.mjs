import { spawnSync } from "node:child_process";
import { describe, expect, test } from "vitest";
import { logSafe } from "../src/log-safe.mjs";

describe("logSafe", () => {
  test("writes the second # of ## before a word and [ as \\u0023, anywhere in a line", () => {
    expect(logSafe("a ##vso[task.setvariable variable=X]y")).toBe(
      "a #\\u0023vso[task.setvariable variable=X]y",
    );
    expect(logSafe("##[warning]w ##teamcity[m] ##VSO[a]")).toBe(
      "#\\u0023[warning]w #\\u0023teamcity[m] #\\u0023VSO[a]",
    );
    expect(logSafe("###vso[a]")).toBe("##\\u0023vso[a]");
  });
  test("writes the first : of a line that starts with :: after its whitespace as \\u003a", () => {
    expect(logSafe("::warning::x")).toBe("\\u003a:warning::x");
    expect(logSafe("ok\n  ::error::x\n\t::a\n\u00a0::b\r::c\n\u0085::d")).toBe(
      "ok\n  \\u003a:error::x\n\t\\u003a:a\n\u00a0\\u003a:b\r\\u003a:c\n\u0085\\u003a:d",
    );
    expect(logSafe("a ::warning::x")).toBe("a ::warning::x");
  });
  test("leaves everything else as it is", () => {
    for (const s of ["", "pbiplint: x does not exist\n", "#vso[a]", "## [a]", "a::b"])
      expect(logSafe(s)).toBe(s);
  });
  test("copies standard input to standard output, escaped, when run as a script", () => {
    const script = new URL("../src/log-safe.mjs", import.meta.url).pathname;
    const r = spawnSync(process.execPath, [script], {
      input: "pbiplint: a ##[warning]b\n  ::error::c\n",
      encoding: "utf8",
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe("pbiplint: a #\\u0023[warning]b\n  \\u003a:error::c\n");
  });
});
