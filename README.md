# test-suites

The authored test suites The Test Cabinet draws its test cases from.

## Overview

This repository holds The Test Cabinet's authored content: the test cases
under `test-cases/<type>/<difficulty>/<slug>/<version>/`, the game jams under
`game-jams/` and the test-case groups under `test-case-groups/`, and the test
suites under `test-suites/`, one folder per suite named by its slug and holding
a `suite.toml`, the editable drafts the suite is authored through and the
immutable versions exported from them. The Spec Cabinet is the only writer of
the suites, and The Test Cabinet ingests exported versions and the catalog
from this checkout. `tools/` holds the npm workspace's tools the content is
authored with, such as the lattice factory designer, and `ci/`, `scripts/` and
`.claude/` the gates and scripts described below. `history/` records how the
catalog's history was extracted from the superrepo.

For more information, see <https://docs.testcabinet.ai/test-suites/overview/>.

This repository is one component of
[The Test Cabinet](https://github.com/TheClockwyrks/TheTestCabinet). What it is
and how it fits with the others is stated by the documentation site, which
lives in the superrepo at `apps/docs/src/content/docs/`. Its Repositories page,
`apps/docs/src/content/docs/development/repositories.md`, draws the edges
between the repositories.

## Getting started

Open the superrepo in its devcontainer, which carries every toolchain the
repositories need, and work from this repository's root.

One command runs every gate:

```sh
make gate
```

Each gate is a file under `ci/gates/` whose stem is the gate's id.
`uv run --quiet --project ci gate list` names them all, and
`azure-pipelines.yml` runs each one as a step of its own on every push, inside
the CI images the superrepo builds.

## The catalog's gates

Beside the kit's gates, this repository runs the catalog's own, each a step of
the pipeline's checks job:

- `frozen-paths` holds every `.frozen` version to the digest its marker
  records; `scripts/freeze.sh <version>...` freezes a version. See
  <https://docs.testcabinet.ai/development/frozen-versions/>.
- `spec-prose` lints and spell-checks the prose a case or jam ships
  (`npm run lint:specs`).
- `spec-vocabulary` keeps evaluation vocabulary out of the seeded specs and
  prompts.
- `audio-packs` resolves every `[audio] packs` declaration against the sample
  packs.
- `validators-typecheck` type-checks every validator project
  (`npm run typecheck:validators`) against the `engines` packages the workspace
  installs from the feed.

`spec-vocabulary` and `audio-packs` also read what this repository does not
hold: the shared prompt wording in `contracts` and the sample packs the backend
publishes. `scripts/lib/siblings.mjs` finds each beside this checkout in the
superrepo, or clones its public mirror when this repository is checked out on
its own, as the pipeline does.

## Mirror

The Test Cabinet names this repository by the relative URL `../test-suites`, so
it resolves on whichever host the superrepo was cloned from. Azure Repos is
where it lives, and `TheClockwyrks/test-suites` on GitHub is its mirror, as
`.nyxsis/mirrors.toml` declares. The mirror stage of `azure-pipelines.yml`
pushes `master`, `staging`, `nightly` and `v*` tags there once every gate has
passed, and refuses a push that would not move the mirror forward. Nothing else
writes to the mirror.
