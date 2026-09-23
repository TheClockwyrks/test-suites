# Test Suites

## Overview

This repository holds the authored test suites The Test Cabinet draws its test
cases from. Each top-level folder is one suite, named by its slug, holding the
editable drafts the suite is authored through and the immutable versions
exported from them. The Spec Cabinet is the only writer of this tree, and The
Test Cabinet ingests exported versions. `.azure-pipelines/` holds this
repository's pipeline and is not a suite.

For more information, see <https://docs.testcabinet.ai/test-suites/overview/>.

## Mirror

The Test Cabinet names this repository by the relative URL `../test-suites`, so
it resolves on whichever host the superproject was cloned from. Azure Repos is
where it lives, and `TheClockwyrks/test-suites` on GitHub is its mirror. The
pipeline in `.azure-pipelines/mirror.yml` force-pushes `master` there on every
push to `master`, and nothing else writes to the mirror.
