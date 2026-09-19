import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Turns a pbiplint SARIF file into GitHub workflow annotations, count outputs, and a job summary.
// Runs inside the composite action with no dependencies; the CLI itself never learns about GitHub.

/** SARIF result levels as GitHub annotation levels. */
const LEVEL = { error: "error", warning: "warning", note: "notice" };

/** GitHub keeps at most this many annotations of each level per step; the rest are dropped silently. */
export const ANNOTATION_CAP = 10;

const run = (sarif) => sarif.runs?.[0] ?? {};

export function countFindings(sarif) {
  const counts = { findings: 0, errors: 0, warnings: 0, infos: 0 };
  for (const r of run(sarif).results ?? []) {
    counts.findings++;
    if (r.level === "error") counts.errors++;
    else if (r.level === "warning") counts.warnings++;
    else counts.infos++;
  }
  return counts;
}

/** Artifact URIs are percent-encoded per segment; workflow commands want the plain workspace path. */
const decodePath = (uri) => uri.split("/").map(decodeURIComponent).join("/");

export function annotations(sarif, { cap = ANNOTATION_CAP } = {}) {
  const rules = new Map((run(sarif).tool?.driver?.rules ?? []).map((r) => [r.id, r]));
  const taken = { error: 0, warning: 0, notice: 0 };
  const out = [];
  for (const r of run(sarif).results ?? []) {
    const level = LEVEL[r.level] ?? "notice";
    if (taken[level] >= cap) continue;
    taken[level]++;
    const rule = rules.get(r.ruleId);
    const name = rule?.name ?? r.ruleId;
    // The CLI writes "object: rule name (detail)"; the title carries the name, so the message
    // keeps the object and the detail and adds the id and the rule page.
    const object = (r.message?.text ?? "").replace(`: ${name}`, "");
    const where = rule?.helpUri ? `: ${rule.helpUri}` : "";
    const loc = r.locations?.[0]?.physicalLocation;
    out.push({
      level,
      file: loc ? decodePath(loc.artifactLocation.uri) : undefined,
      line: loc?.region?.startLine,
      title: name,
      message: `${object}. Rule ${r.ruleId}${where}`,
    });
  }
  return out;
}

// Workflow commands: https://docs.github.com/actions/reference/workflow-commands-for-github-actions
const escapeData = (s) =>
  String(s).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
const escapeProperty = (s) => escapeData(s).replace(/:/g, "%3A").replace(/,/g, "%2C");

export function workflowCommand({ level, file, line, title, message }) {
  const props = [];
  if (file !== undefined) props.push(`file=${escapeProperty(file)}`);
  if (line !== undefined) props.push(`line=${line}`);
  props.push(`title=${escapeProperty(title)}`);
  return `::${level} ${props.join(",")}::${escapeData(message)}`;
}

export function outputs(counts) {
  return ["findings", "errors", "warnings", "infos"].map((k) => `${k}=${counts[k]}\n`).join("");
}

/** A job summary holds 1 MiB; this leaves headroom for the footer and multi-byte characters. */
export const SUMMARY_LIMIT = 1_000_000;

export function summary({ markdown, counts, annotated, annotate = true, exitCode = 0 }) {
  if (markdown === undefined)
    return `## pbiplint\n\npbiplint did not produce a report (exit code ${exitCode}). See the lint step's log for the error.\n`;
  const footer =
    annotate && annotated < counts.findings
      ? `\nAnnotations on this run show ${annotated} of ${counts.findings} findings, the first ${ANNOTATION_CAP} of each severity. The full list is above.\n`
      : "";
  let body = markdown;
  if (body.length + footer.length > SUMMARY_LIMIT) {
    const note =
      "\n\n_Report truncated: a job summary holds at most 1 MB. Run pbiplint locally for the full report._\n";
    body = body.slice(0, SUMMARY_LIMIT - note.length - footer.length) + note;
  }
  return body + footer;
}

export function main({ sarifPath, markdownPath, annotate, exitCode, env, stdout }) {
  const sarif = existsSync(sarifPath) ? JSON.parse(readFileSync(sarifPath, "utf8")) : undefined;
  const markdown = existsSync(markdownPath) ? readFileSync(markdownPath, "utf8") : undefined;
  const counts = sarif ? countFindings(sarif) : { findings: 0, errors: 0, warnings: 0, infos: 0 };
  const list = sarif && annotate ? annotations(sarif) : [];
  for (const a of list) stdout(workflowCommand(a));
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, outputs(counts));
  if (env.GITHUB_STEP_SUMMARY)
    appendFileSync(
      env.GITHUB_STEP_SUMMARY,
      summary({ markdown, counts, annotated: list.length, annotate, exitCode }),
    );
}

// node src/annotate.mjs --sarif <file> --markdown <file> --annotations true|false --exit-code <n>
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = (name) => {
    const i = process.argv.indexOf(`--${name}`);
    return i === -1 ? undefined : process.argv[i + 1];
  };
  main({
    sarifPath: arg("sarif"),
    markdownPath: arg("markdown"),
    annotate: arg("annotations") !== "false",
    exitCode: Number(arg("exit-code") ?? 0),
    env: process.env,
    stdout: console.log,
  });
}
