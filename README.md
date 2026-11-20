# pbiplint action

Lint Power BI projects on every pull request. One step in your workflow runs
[pbiplint](https://pbiplint.com) against the project in your repository, its semantic model and its
report, and turns the findings into a pass/fail check, annotations on the changed lines, a readable
job summary, and code scanning alerts. Nothing from your project leaves GitHub, and the one request
beyond it is the pinned pbiplint download from npm;
[Pipelines: GitHub Actions and Azure Pipelines](https://pbiplint.com/pipelines/#github-actions)
lists what each step sends where, and how to check it.

```yaml
name: Lint Power BI
on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read
  security-events: write # for code scanning; drop it and set upload-sarif: false otherwise

jobs:
  pbiplint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: pbiplint/action@v1
        with:
          path: Sales.pbip
```

## What a run does

- **Fails the check** when findings reach the `fail-on` severity (errors by default), so a project
  that breaks a rule cannot merge. A rule that cannot finish on part of a project is reported as a
  `RULE_COULD_NOT_FINISH` error, so it fails the check too. Set `fail-on: none` to report without
  ever failing.
- **Annotates the run and the pull request.** Each finding lands on its line of TMDL or report
  JSON in the Files changed tab. GitHub shows at most 10 annotations per severity per step; the
  rest are in the summary.
- **Writes the full report to the job summary**, ranked, with a link to each rule's page. When the
  project has a report, the summary's "Report at a glance" says what the report will do when
  someone opens it, whether or not anything fired. When pbiplint produces no report, for example
  because it could read nothing at `path`, the summary gives pbiplint's reason instead.
- **Uploads a SARIF report to code scanning**, where findings persist as alerts under the
  Security tab and show as new or fixed on later pull requests.

The rules are the ones pbiplint runs everywhere. The semantic model is checked against Microsoft's
best-practice ruleset, ported and verified, and pbiplint's own rules for a year or a date fixed in
DAX, for DAX user-defined functions, for translations, and for decimal columns' format strings. The
report, in the PBIR format, is checked against the 11 base rules of PBI Inspector, ported, and
pbiplint's own rules for a report's correctness and readiness, for text with too little contrast,
and for the model objects the report never reaches. The model's Power Query M is read with
Microsoft's own parser and checked against 15 rules of pbiplint's own, which makes 123 rules in all. Every rule has a page at
https://pbiplint.com/rules with what it checks, why, and how to fix it. Configure rules with a
`pbiplint.config.json` next to your project, as on the command line; the action picks it up.

Version 1.9.0 of the action runs pbiplint 0.3.4. Next to 1.8.0, it adds a rule for report text
with too little contrast (`LOW_TEXT_CONTRAST`), a warning, so it does not fail a step at the default
`fail-on: error`; a theme file that `report.json` names and that does not parse is now a
`PARSE_ISSUE` error, which does. The
[0.3.4 release notes](https://github.com/pbiplint/pbiplint/releases/tag/v0.3.4) say more. Next to
1.7.0, which ran pbiplint 0.3.0, a few findings also change, each a fix, and a crafted Power Query query can no longer stall or end a run; the
[0.3.2](https://github.com/pbiplint/pbiplint/releases/tag/v0.3.2) and
[0.3.3](https://github.com/pbiplint/pbiplint/releases/tag/v0.3.3) release notes list each change.
Coming from 1.6.0 or earlier, which ran pbiplint 0.2.5, a step that passed can now fail at the
default `fail-on: error`. Three of 0.3.0's new rules are errors (`DYNAMIC_DATA_SOURCE`,
`HARDCODED_SECRET_IN_QUERY`, and `INCREMENTAL_REFRESH_RANGE_BOUNDS`), and a rule that cannot finish
is now an error as well. The
[0.3.0 release notes](https://github.com/pbiplint/pbiplint/releases/tag/v0.3.0) say what else
changes in a project's findings and how to try the three new errors on a project first. To keep
the older results while you fix what is new, set `pbiplint-version: 0.2.5`.

## Inputs

| Input              | Default    | What it does                                                                                                                                                |
| ------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `path`             | `.`        | What to lint, relative to the workspace: a PBIP folder, a `.pbip` file, a `.SemanticModel` or `.Report` folder, a `definition` folder, or one `.tmdl` file. |
| `fail-on`          | `error`    | Lowest severity that fails the step: `error`, `warning`, `info`, or `none`.                                                                                 |
| `config`           |            | A `pbiplint.config.json` to use. By default the nearest one above the project applies.                                                                      |
| `pbiplint-version` | `0.3.4`    | The pbiplint CLI version to run. Each release of this action pins the current one; override to try a newer CLI early.                                       |
| `annotations`      | `true`     | Annotate findings on the run and the pull request.                                                                                                          |
| `upload-sarif`     | `true`     | Upload the SARIF report to code scanning. When the upload fails, the step notes why and carries on.                                                         |
| `sarif-category`   | `pbiplint` | The code scanning category of the upload. Give each step its own when one workflow has several pbiplint steps.                                              |

## Outputs

| Output       | What it holds                                                                                                                                         |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `exit-code`  | pbiplint's exit code: `0` no findings at or above `fail-on`, `1` findings at or above `fail-on`, `2` usage or input error, or pbiplint could not run. |
| `sarif-file` | Path of the SARIF report, for an upload-artifact step or your own tooling.                                                                            |
| `findings`   | Number of findings.                                                                                                                                   |
| `errors`     | Number of error findings.                                                                                                                             |
| `warnings`   | Number of warning findings.                                                                                                                           |
| `infos`      | Number of info findings.                                                                                                                              |

## Code scanning

The SARIF upload needs `security-events: write` on the job. Public repositories get code scanning
free. A private repository needs GitHub Code Security; without it the upload fails, the step
prints a notice, and the run carries on. Set `upload-sarif: false` to stop trying. Annotations and
the summary work everywhere and need no permission.

When one workflow has several pbiplint steps, give each its own `sarif-category`, or the second
upload replaces the first. One step that lints several projects makes one upload and needs only one
category.

## Several projects

One step lints every project in a folder. Point `path` at a folder that holds several Power BI
projects, below it or side by side as Power BI Desktop saves them, and pbiplint lints each one, up
to 200, under one summary with one exit code and one SARIF upload. A model that several reports
share is read once and its findings are listed once.

```yaml
- uses: pbiplint/action@v1
  with:
    path: reports
```

The default `path`, `.`, works the same way, so a repository with its projects in subfolders needs
no `path` at all, and neither does one whose top level is the project folder, with the
`.SemanticModel` and `.Report` folders in it. A project in the folder that pbiplint cannot read,
such as a model saved in the older `model.bim` format, is a `PARSE_ISSUE` error while the others
are still linted. A folder with more than 200 projects, or with none that pbiplint can read, fails
the step with exit code 2.

Separate steps still work, for example to give each project its own check or its own alerts. Point
`path` at each and, if you upload, give each its own category:

```yaml
- uses: pbiplint/action@v1
  with:
    path: Sales.pbip
    sarif-category: pbiplint/sales
- uses: pbiplint/action@v1
  with:
    path: Finance.pbip
    sarif-category: pbiplint/finance
```

A `.pbip` file names its report, and the report names its model, so two projects saved in one
folder lint apart. A step that names one `.pbip` reads only what is in that project's folder: a
report whose model is kept elsewhere, such as in a shared `models/` folder, is linted without it,
and a notice names the folder to lint instead.

## Runners

Works on the GitHub-hosted Ubuntu, Windows, and macOS runners, which all have Node.js. A
self-hosted runner needs Node.js 20.19 or later on the path. The linter reads only the projects
that `path` names and their `pbiplint.config.json`, or the one the `config` input names, and makes
no network calls of its own; the one download is the pinned pbiplint package from npm.

## How it works

This is a composite action, so everything it runs is in [`action.yml`](action.yml): the published
`pbiplint` CLI at the pinned version, a dependency-free script that turns the SARIF report into
annotations and a summary, and GitHub's own `upload-sarif` step. There is no bundled code to
audit.

## Links

- pbiplint: https://pbiplint.com, source at https://github.com/pbiplint/pbiplint
- Rule pages: https://pbiplint.com/rules
- Issues with the action: https://github.com/pbiplint/action/issues

## License

The action is MIT licensed; see [LICENSE](LICENSE). pbiplint itself is licensed separately under
the AGPL, which places no restriction on running it in your workflow. The name pbiplint and its
logo are trademarks of McKinley Consulting.
