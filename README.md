# test-suites

The authored test suites The Test Cabinet draws its test cases from.

## Overview

This repository holds the authored test suites The Test Cabinet draws its test
cases from. Each top-level folder holding a `suite.toml` is one suite, named by
its slug, holding the editable drafts the suite is authored through and the
immutable versions exported from them. The Spec Cabinet is the only writer of
the suites, and The Test Cabinet ingests exported versions. A folder without a
`suite.toml` is not a suite: `ci/`, `scripts/` and `.claude/` are the
repository kit's, described below.

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

## Mirror

The Test Cabinet names this repository by the relative URL `../test-suites`, so
it resolves on whichever host the superrepo was cloned from. Azure Repos is
where it lives, and `TheClockwyrks/test-suites` on GitHub is its mirror, as
`.nyxsis/mirrors.toml` declares. The mirror stage of `azure-pipelines.yml`
pushes `master`, `staging`, `nightly` and `v*` tags there once every gate has
passed, and refuses a push that would not move the mirror forward. Nothing else
writes to the mirror.
