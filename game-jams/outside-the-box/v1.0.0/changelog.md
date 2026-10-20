Introduced. A game jam on the theme **Outside the Box**: build a puzzle game of any
kind, shipping at least eight hand-designed levels that climb in difficulty from a
gentle start to a genuinely hard finish. The kind of puzzle is left open. Judged on
the generic graded review checklist.

The workspace now ships the `package-lock.json` that pins its `package.json`,
and init installs from it with `npm ci` instead of `npm install`, so a run
starts from a lockfile committed in the seed commit rather than an untracked one
left for the model to commit.
