# Contributing

```bash
npm install
npm test        # unit tests for the annotation script
npm run lint    # eslint and prettier
```

The action is `action.yml` plus `src/annotate.mjs`. The script has no dependencies and is tested
against `test/fixtures/messy-sales.sarif`, which is the CLI's SARIF output for the main
repository's `examples/messy-sales` at the pinned version. Regenerate it from a checkout of
https://github.com/pbiplint/pbiplint when the CLI's output changes:

```bash
npx pbiplint@0.1.2 examples/messy-sales --format sarif --output ../pbiplint-action/test/fixtures/messy-sales.sarif
```

There is no way to run a composite action locally, so CI runs the action on itself against the
same example; see `.github/workflows/ci.yml`. Open a pull request and read the dogfood jobs.

Bugs in the rules or the report belong in the main repository:
https://github.com/pbiplint/pbiplint/issues. This repository is for the action itself.
