# Security

The action runs the published pbiplint CLI at a pinned version on the runner, reads the files under
`path`, and writes a report to the runner's temp folder, the job summary, and, if enabled, code
scanning. Inputs reach the shell through environment variables, never through expression
substitution inside a script.

Report a vulnerability privately through GitHub:
[open a draft advisory](https://github.com/pbiplint/action/security/advisories/new). Anything in
the linter itself belongs in the main repository's advisories at
https://github.com/pbiplint/pbiplint/security.
