Introduced. A game jam on the theme **Well, Well, Well**: build a game where gravity
is the whole point, set in a star system that won't hold still. Judged on the generic
graded review checklist.

The workspace now ships the `package-lock.json` that pins its `package.json`,
and init installs from it with `npm ci` instead of `npm install`, so a run
starts from a lockfile committed in the seed commit rather than an untracked one
left for the model to commit.
