# history

The record of how this repository's catalog history was extracted from the
superrepo, [The Test Cabinet](https://github.com/TheClockwyrks/TheTestCabinet),
where `test-cases/`, `game-jams/` and `test-case-groups/` lived until the
extraction. Nothing builds or tests against these files; they are kept so the
provenance outlives the scratch clone the extraction ran in.

## The extraction

The catalog's history is the superrepo's `nightly` at
`447be335212a46e9c4bafad2aefbe7bcac9b566b`, filtered to the paths in
[`paths.txt`](paths.txt) by git filter-repo 2.47.0, and merged into this
repository's history as an unrelated one:

```sh
git clone -q --no-local --single-branch --branch nightly --no-tags <the-test-cabinet> x
cd x
uvx --from git-filter-repo==2.47.0 git-filter-repo --force \
  --paths-from-file ../paths.txt --prune-empty always --preserve-commit-hashes
```

Of the 6,819 commits reachable from that commit, 4,207 touched a path in the
list and were kept (131 of them merges); the rest were pruned. No tag was
carried. The tip tree of each of the three directories hashes the same as the
superrepo's at that commit.

The paths are kept where they were in the superrepo, so the filter needed no
rename, every relative path inside a version works as it did, and the digest
each `.frozen` marker records, taken over `git ls-files -s` of its directory,
still matches.

## The files

- [`paths.txt`](paths.txt) is the list handed to `--paths-from-file`
  (sha256 `127c6409e01aaf74b9d15c359fd72066060fd8aeb31cf5a0e465e8aa9969f063`).
  It is generated, not hand-written: every path under the three directories
  that `git log --full-history -m --name-only` names over the whole history,
  and every path a file had before a rename or copy, collected from
  `git log -m -M -C --name-status` and followed to a fixed point, so a file's
  history reaches back past the commits that moved it into place.
- [`commit-map`](commit-map) is filter-repo's map from each superrepo commit
  (left) to the commit it became here (right), all zeros for a pruned one.
  `--preserve-commit-hashes` left the commit ids quoted in the messages as they
  were, so an id in a message of the merged history names a superrepo commit,
  and this map translates it.

## The live-path review

`paths.txt` names eight paths outside the three directories, each the source a
catalog file was detected as copied from:

```text
packages/case-harness/src/chromium.ts
packages/particle-runtime/package.json
packages/run-record/package.json
packages/simple-2d/docs/README.md
packages/simple-2d/docs/assets.md
packages/simple-2d/docs/diagnostics.md
packages/simple-2d/docs/input.md
packages/simple-2d/package.json
```

None is live at the extraction commit (each had moved to `engines` or
`contracts` before it), so the merged tip holds the three directories alone.
They were kept in the list so `git log --follow` and blame of the files copied
from them reach their history before the copy.
