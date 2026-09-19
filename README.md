# pbiplint action

Lint Power BI projects on every pull request. One step in your workflow runs
[pbiplint](https://pbiplint.com) against the semantic model in your repository and turns the
findings into a pass/fail check, annotations on the changed lines, a readable job summary, and code
scanning alerts. Nothing leaves GitHub.

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
          path: Sales.SemanticModel
```

## What a run does

- **Fails the check** when findings reach the `fail-on` severity (errors by default), so a model
  that breaks a rule cannot merge. Set `fail-on: none` to report without ever failing.
- **Annotates the run and the pull request.** Each finding lands on its TMDL line in the Files
  changed tab. GitHub shows at most 10 annotations per severity per step; the rest are in the
  summary.
- **Writes the full report to the job summary**, ranked, with a link to each rule's page.
- **Uploads a SARIF report to code scanning**, where findings persist as alerts under the
  Security tab and show as new or fixed on later pull requests.

The rules are the ones pbiplint runs everywhere: Microsoft's best-practice ruleset for semantic
models, ported and verified. Every rule has a page at https://pbiplint.com/rules with what it
checks, why, and how to fix it. Configure rules with a `pbiplint.config.json` next to your model,
exactly as on the command line; the action picks it up.

## Inputs

| Input              | Default    | What it does                                                                                                                    |
| ------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `path`             | `.`        | What to lint, relative to the workspace: a `.SemanticModel` folder, a PBIP folder, a `definition` folder, or one `.tmdl` file.  |
| `fail-on`          | `error`    | Lowest severity that fails the step: `error`, `warning`, `info`, or `none`.                                                     |
| `config`           |            | A `pbiplint.config.json` to use. By default the nearest one above the model applies.                                            |
| `pbiplint-version` | `0.1.2`    | The pbiplint CLI version to run. Each release of this action pins the current one; override to try a newer CLI early.           |
| `annotations`      | `true`     | Annotate findings on the run and the pull request.                                                                              |
| `upload-sarif`     | `true`     | Upload the SARIF report to code scanning. When the upload fails, the step notes why and carries on.                              |
| `sarif-category`   | `pbiplint` | The code scanning category of the upload. Give each step its own when one workflow lints several models.                        |

## Outputs

| Output       | What it holds                                                                          |
| ------------ | -------------------------------------------------------------------------------------- |
| `exit-code`  | pbiplint's exit code: `0` clean, `1` findings at or above `fail-on`, `2` usage error. |
| `sarif-file` | Path of the SARIF report, for an upload-artifact step or your own tooling.             |
| `findings`   | Number of findings.                                                                    |
| `errors`     | Number of error findings.                                                              |
| `warnings`   | Number of warning findings.                                                            |
| `infos`      | Number of info findings.                                                               |

## Code scanning

The SARIF upload needs `security-events: write` on the job. Public repositories get code scanning
free. A private repository needs GitHub Code Security; without it the upload fails, the step
prints a notice, and the run carries on. Set `upload-sarif: false` to stop trying. Annotations and
the summary work everywhere and need no permission.

When one workflow lints several models, give each step its own `sarif-category`, or the second
upload replaces the first.

## Several models

One step per model. Point `path` at each and, if you upload, give each its own category:

```yaml
- uses: pbiplint/action@v1
  with:
    path: Sales.SemanticModel
    sarif-category: pbiplint/sales
- uses: pbiplint/action@v1
  with:
    path: Finance.SemanticModel
    sarif-category: pbiplint/finance
```

A repository with exactly one `.SemanticModel` folder under the path needs no `path` at all.

## Runners

Works on the GitHub-hosted Ubuntu, Windows, and macOS runners, which all have Node.js. A
self-hosted runner needs Node.js 20.19 or later on the path. The linter reads only the files under
`path` and makes no network calls of its own; the one download is the pinned pbiplint package from
npm.

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
