import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { annotations, countFindings, workflowCommand } from "../src/annotate.mjs";

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/messy-sales.sarif", import.meta.url), "utf8"),
);

/** A one-run SARIF document with the given rules and results, shaped like pbiplint's. */
function sarif(rules, results) {
  return { version: "2.1.0", runs: [{ tool: { driver: { name: "pbiplint", rules } }, results }] };
}

const RULE = {
  id: "PROVIDE_FORMAT_STRING_FOR_MEASURES",
  name: "Provide format string for measures",
  helpUri: "https://pbiplint.com/rules/provide-format-string-for-measures",
};

function result(level, text, uri, line) {
  return {
    ruleId: RULE.id,
    ruleIndex: 0,
    level,
    message: { text },
    ...(uri
      ? {
          locations: [
            { physicalLocation: { artifactLocation: { uri }, region: { startLine: line } } },
          ],
        }
      : {}),
  };
}

describe("countFindings", () => {
  test("counts every result by level", () => {
    expect(countFindings(fixture)).toEqual({ findings: 161, errors: 16, warnings: 39, infos: 106 });
  });

  test("an empty run counts to zero", () => {
    expect(countFindings(sarif([], []))).toEqual({ findings: 0, errors: 0, warnings: 0, infos: 0 });
  });
});

describe("annotations", () => {
  test("maps a result to a file annotation with the rule name as title", () => {
    const doc = sarif(
      [RULE],
      [
        result(
          "error",
          "[Total Sales]: Provide format string for measures",
          "Sales.SemanticModel/definition/tables/Sales.tmdl",
          112,
        ),
      ],
    );
    expect(annotations(doc)).toEqual([
      {
        level: "error",
        file: "Sales.SemanticModel/definition/tables/Sales.tmdl",
        line: 112,
        title: "Provide format string for measures",
        message:
          "[Total Sales]. Rule PROVIDE_FORMAT_STRING_FOR_MEASURES: https://pbiplint.com/rules/provide-format-string-for-measures",
      },
    ]);
  });

  test("keeps a finding's detail in the message", () => {
    const doc = sarif(
      [RULE],
      [
        result(
          "warning",
          "[Margin %]: Provide format string for measures (no dynamic format either)",
          "a.tmdl",
          3,
        ),
      ],
    );
    expect(annotations(doc)[0].message).toBe(
      "[Margin %] (no dynamic format either). Rule PROVIDE_FORMAT_STRING_FOR_MEASURES: https://pbiplint.com/rules/provide-format-string-for-measures",
    );
  });

  test("maps SARIF levels to GitHub annotation levels", () => {
    const doc = sarif(
      [RULE],
      [
        result("error", "a: x", "a.tmdl", 1),
        result("warning", "b: x", "a.tmdl", 2),
        result("note", "c: x", "a.tmdl", 3),
      ],
    );
    expect(annotations(doc).map((a) => a.level)).toEqual(["error", "warning", "notice"]);
  });

  test("decodes percent-encoded artifact URIs into workspace paths", () => {
    const doc = sarif(
      [RULE],
      [result("error", "a: x", "My%20Model.SemanticModel/definition/tables/Fact%20Sales.tmdl", 7)],
    );
    expect(annotations(doc)[0].file).toBe(
      "My Model.SemanticModel/definition/tables/Fact Sales.tmdl",
    );
  });

  test("a result without a location becomes an annotation without a file", () => {
    const doc = sarif([RULE], [result("warning", "Model: x")]);
    expect(annotations(doc)[0]).toMatchObject({
      level: "warning",
      file: undefined,
      line: undefined,
    });
  });

  test("keeps at most ten per level, in the file's ranked order", () => {
    const out = annotations(fixture);
    const byLevel = (l) => out.filter((a) => a.level === l);
    expect(byLevel("error")).toHaveLength(10);
    expect(byLevel("warning")).toHaveLength(10);
    expect(byLevel("notice")).toHaveLength(10);
    // The first result of the fixture is the first error annotated.
    expect(byLevel("error")[0]).toMatchObject({
      file: "examples/messy-sales/definition/tables/Sales.tmdl",
      line: 115,
      title: "Column references should be fully qualified",
    });
  });

  test("the per-level cap is an option", () => {
    expect(annotations(fixture, { cap: 2 })).toHaveLength(6);
  });

  test("falls back to the rule id when the driver has no rule entry", () => {
    const doc = sarif([], [{ ruleId: "SOME_RULE", level: "error", message: { text: "x: y" } }]);
    expect(annotations(doc)[0]).toMatchObject({
      title: "SOME_RULE",
      message: "x: y. Rule SOME_RULE",
    });
  });
});

describe("workflowCommand", () => {
  test("formats a file annotation as a workflow command", () => {
    expect(
      workflowCommand({
        level: "error",
        file: "a/b.tmdl",
        line: 5,
        title: "Title",
        message: "Message",
      }),
    ).toBe("::error file=a/b.tmdl,line=5,title=Title::Message");
  });

  test("omits file and line when the annotation has none", () => {
    expect(workflowCommand({ level: "notice", title: "T", message: "M" })).toBe(
      "::notice title=T::M",
    );
  });

  test("escapes the characters GitHub reserves in properties and messages", () => {
    expect(
      workflowCommand({
        level: "warning",
        file: "odd,name:here.tmdl",
        line: 1,
        title: "Date/calendar: 100% sure, really",
        message: "line one\nline two 100%\r",
      }),
    ).toBe(
      "::warning file=odd%2Cname%3Ahere.tmdl,line=1,title=Date/calendar%3A 100%25 sure%2C really::line one%0Aline two 100%25%0D",
    );
  });
});

import { mkdtempSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main, outputs, summary, SUMMARY_LIMIT } from "../src/annotate.mjs";

const COUNTS = { findings: 161, errors: 16, warnings: 39, infos: 106 };

describe("outputs", () => {
  test("writes one name=value line per count", () => {
    expect(outputs(COUNTS)).toBe("findings=161\nerrors=16\nwarnings=39\ninfos=106\n");
  });
});

describe("summary", () => {
  test("is the markdown report followed by a note on how many findings were annotated", () => {
    const text = summary({
      markdown: "# pbiplint report\n\nbody\n",
      counts: COUNTS,
      annotated: 30,
    });
    expect(text).toBe(
      "# pbiplint report\n\nbody\n\nAnnotations on this run show 30 of 161 findings, the first 10 of each severity. The full list is above.\n",
    );
  });

  test("says nothing about annotations when every finding was annotated", () => {
    const counts = { findings: 3, errors: 3, warnings: 0, infos: 0 };
    expect(summary({ markdown: "report\n", counts, annotated: 3 })).toBe("report\n");
  });

  test("says nothing about annotations when they are off", () => {
    expect(summary({ markdown: "report\n", counts: COUNTS, annotated: 0, annotate: false })).toBe(
      "report\n",
    );
  });

  test("truncates a report that would exceed the job summary limit", () => {
    const big = "x".repeat(SUMMARY_LIMIT + 100);
    const text = summary({ markdown: big, counts: COUNTS, annotated: 30, annotate: false });
    expect(text.length).toBeLessThanOrEqual(SUMMARY_LIMIT);
    expect(
      text.endsWith(
        "\n\n_Report truncated: a job summary holds at most 1 MB. Run pbiplint locally for the full report._\n",
      ),
    ).toBe(true);
  });

  test("explains a missing report", () => {
    expect(
      summary({
        markdown: undefined,
        counts: { findings: 0, errors: 0, warnings: 0, infos: 0 },
        annotated: 0,
        exitCode: 2,
      }),
    ).toBe(
      "## pbiplint\n\npbiplint did not produce a report (exit code 2). See the lint step's log for the error.\n",
    );
  });
});

describe("main", () => {
  function setup() {
    const dir = mkdtempSync(join(tmpdir(), "pbiplint-action-"));
    const env = { GITHUB_OUTPUT: join(dir, "output"), GITHUB_STEP_SUMMARY: join(dir, "summary") };
    writeFileSync(env.GITHUB_OUTPUT, "exit-code=1\n");
    writeFileSync(env.GITHUB_STEP_SUMMARY, "");
    const lines = [];
    return { dir, env, lines, stdout: (s) => lines.push(s) };
  }

  test("prints the annotations, appends the outputs, and appends the summary", () => {
    const { dir, env, lines, stdout } = setup();
    const sarifPath = join(dir, "pbiplint.sarif");
    const markdownPath = join(dir, "pbiplint.md");
    writeFileSync(sarifPath, JSON.stringify(fixture));
    writeFileSync(markdownPath, "# pbiplint report\n\nbody\n");
    main({ sarifPath, markdownPath, annotate: true, exitCode: 1, env, stdout });
    expect(lines).toHaveLength(30);
    expect(lines[0]).toMatch(
      /^::error file=examples\/messy-sales\/definition\/tables\/Sales\.tmdl,line=115,title=/,
    );
    expect(readFileSync(env.GITHUB_OUTPUT, "utf8")).toBe(
      "exit-code=1\nfindings=161\nerrors=16\nwarnings=39\ninfos=106\n",
    );
    expect(readFileSync(env.GITHUB_STEP_SUMMARY, "utf8")).toMatch(
      /^# pbiplint report\n\nbody\n\nAnnotations on this run show 30 of 161 findings/,
    );
  });

  test("prints nothing when annotations are off", () => {
    const { dir, env, lines, stdout } = setup();
    const sarifPath = join(dir, "pbiplint.sarif");
    writeFileSync(sarifPath, JSON.stringify(fixture));
    main({
      sarifPath,
      markdownPath: join(dir, "missing.md"),
      annotate: false,
      exitCode: 1,
      env,
      stdout,
    });
    expect(lines).toHaveLength(0);
    expect(readFileSync(env.GITHUB_OUTPUT, "utf8")).toContain("findings=161\n");
  });

  test("copes with a run that produced no report", () => {
    const { dir, env, lines, stdout } = setup();
    main({
      sarifPath: join(dir, "none.sarif"),
      markdownPath: join(dir, "none.md"),
      annotate: true,
      exitCode: 2,
      env,
      stdout,
    });
    expect(lines).toHaveLength(0);
    expect(readFileSync(env.GITHUB_OUTPUT, "utf8")).toBe(
      "exit-code=1\nfindings=0\nerrors=0\nwarnings=0\ninfos=0\n",
    );
    expect(readFileSync(env.GITHUB_STEP_SUMMARY, "utf8")).toContain(
      "did not produce a report (exit code 2)",
    );
    expect(existsSync(join(dir, "none.sarif"))).toBe(false);
  });
});

import { spawnSync } from "node:child_process";

describe("command line", () => {
  test("runs from the arguments the action passes", () => {
    const dir = mkdtempSync(join(tmpdir(), "pbiplint-action-"));
    const env = {
      ...process.env,
      GITHUB_OUTPUT: join(dir, "output"),
      GITHUB_STEP_SUMMARY: join(dir, "summary"),
    };
    writeFileSync(env.GITHUB_OUTPUT, "");
    writeFileSync(env.GITHUB_STEP_SUMMARY, "");
    const sarifPath = join(dir, "pbiplint.sarif");
    writeFileSync(sarifPath, JSON.stringify(fixture));
    writeFileSync(join(dir, "pbiplint.md"), "report\n");
    const script = new URL("../src/annotate.mjs", import.meta.url).pathname;
    const r = spawnSync(
      process.execPath,
      [
        script,
        "--sarif",
        sarifPath,
        "--markdown",
        join(dir, "pbiplint.md"),
        "--annotations",
        "true",
        "--exit-code",
        "1",
      ],
      { env, encoding: "utf8" },
    );
    expect(r.status).toBe(0);
    expect(r.stdout.split("\n").filter((l) => l.startsWith("::"))).toHaveLength(30);
    expect(readFileSync(env.GITHUB_OUTPUT, "utf8")).toContain("findings=161\n");
    expect(readFileSync(env.GITHUB_STEP_SUMMARY, "utf8")).toContain(
      "Annotations on this run show 30 of 161",
    );
  });
});
