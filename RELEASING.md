# Releasing the action

Users write `pbiplint/action@v1`. That moving tag follows the newest `v1.x.y` release, so a release
is a semver tag and nothing more.

## After a pbiplint CLI release

1. On a branch, change the `pbiplint-version` default in `action.yml` to the new version and the
   `0.1.2` in README.md's inputs table to match.
2. Run `npm test`, open a pull request, let CI pass. The dogfood jobs run the action on the
   messy-sales example with the new version.
3. Merge, then release as below. A CLI patch is a patch here; a CLI minor that adds rules or
   changes output is a minor here.

## Every release

1. On a branch from main, set the version in `package.json` (the tag must match it), commit as
   `chore: release v1.1.0`, open a pull request, let CI pass, merge.
2. Tag the merge commit and push the tag:

   ```bash
   git fetch origin main && git tag v1.1.0 origin/main && git push origin v1.1.0
   ```

3. The Release workflow checks the tag against `package.json`, runs lint and tests, moves the `v1`
   tag to the same commit, and creates the GitHub release with generated notes. Watch it with
   `gh run watch --repo pbiplint/action`.
4. A new major (`v2.0.0`) creates a new moving tag, `v2`, and leaves `v1` where it was. Only a
   change that breaks existing workflows, such as a renamed input or a changed default, earns one.

## Marketplace

The release created by the workflow is not on the Marketplace until a person ticks the box. Open
the release on GitHub, choose Edit, tick "Publish this release to the GitHub Marketplace", pick the
primary category (Continuous integration) and a secondary one (Code quality), and save. The listing
takes its name, description, icon, and colour from `action.yml`. Done once for v1.0.0; later
releases carry the listing forward.

## Pinned actions

`actions/*` are pinned by major, as in the main repository. The `upload-sarif` step in `action.yml`
and the release step are pinned to a commit with the version in a comment; Dependabot proposes the
bumps.
