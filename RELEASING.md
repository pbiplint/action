# Releasing the action

Users write `pbiplint/action@v1`. That moving tag follows the newest `v1.x.y` release, so a release
is a semver tag and nothing more.

## After a pbiplint CLI release

1. On a branch, change the `pbiplint-version` default in `action.yml` to the new version and the
   version in README.md's inputs table to match.
2. Move the sample pin, the `ref` of the messy-sales checkout in `.github/workflows/ci.yml` and
   `smoke.yml`, to the commit the main repository's release tag points at, so the dogfood and
   smoke runs lint the sample that release shipped with.
3. Move the version in CONTRIBUTING.md's fixture command to the new one, then regenerate
   `test/fixtures/messy-sales.sarif` with that command from a checkout of the main repository at
   the same commit. Move the tests' pins to what the new file holds: the counts everywhere they
   appear (`countFindings`, `COUNTS`, every `findings=` outputs line, and the summary's "30 of N
   findings"), and the first annotation's file, line, and title. Nothing fails on a stale fixture,
   since the unit tests read the committed file and the dogfood checks pin no count, so this step is
   easy to miss.
4. Run `npm test`, open a pull request, let CI pass. The dogfood jobs run the action on the
   messy-sales example with the new version.
5. Merge, then release as below. Number the release by what the CLI release does, not by its own
   number: one that adds rules or changes the findings an unchanged project gets is a minor here,
   since a workflow gated with `fail-on` can start failing when `v1` moves; any other is a patch.
   CLI 0.2.1 was numbered a patch but added a rule, so it made 1.2.0.

When the sample at the new pin needs the new CLI, as 0.2.0's did (its `pbiplint.config.json` sets
a rule option the older CLI refuses), do not run the Smoke workflow between the merge and the tag.
It runs the released `pbiplint/action@v1`, whose older CLI exits 2 on that sample. Run it once the
new tag is out, as `smoke.yml` asks.

## Every release

1. If this release changes an input, a permission, or a step, check
   https://pbiplint.com/pipelines/#github-actions and open a pull request in pbiplint/pbiplint for
   what changed.
2. On a branch from main, set the version in `package.json` (the tag must match it), commit as
   `chore: release v1.1.0`, open a pull request, let CI pass, merge.
3. Tag the merge commit and push the tag:

   ```bash
   git fetch origin main && git tag v1.1.0 origin/main && git push origin v1.1.0
   ```

4. The Release workflow checks the tag against `package.json`, runs lint and tests, moves the `v1`
   tag to the same commit, and creates the GitHub release with generated notes. Watch it with
   `gh run watch --repo pbiplint/action`.
5. A new major (`v2.0.0`) creates a new moving tag, `v2`, and leaves `v1` where it was. Only a
   change that breaks existing workflows, such as a renamed input or a changed default, earns one.

## Marketplace

The release created by the workflow is not on the Marketplace until a person ticks the box. Open
the release on GitHub, choose Edit, tick "Publish this release to the GitHub Marketplace", pick the
primary category (Continuous integration) and a secondary one (Code quality), and save. The listing
takes its name, description, icon, and colour from `action.yml`. The description must be under 125
characters, or the publish is refused; the first attempt on v1.0.0 was, which is why v1.0.1 exists. Done once for v1.0.0; later
releases carry the listing forward.

## Pinned actions

`actions/*` are pinned by major, as in the main repository. The `upload-sarif` step in `action.yml`
and the release step are pinned to a commit with the version in a comment; Dependabot proposes the
bumps.
