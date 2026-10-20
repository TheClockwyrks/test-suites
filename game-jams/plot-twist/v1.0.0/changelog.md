Introduced. A game jam on the theme **Plot Twist**: build a choice-driven narrative
game whose meaningful, branching choices genuinely shape how the story unfolds — the
line between a game and a book. The kind of story and how it is presented are left open.
Judged on the generic graded review checklist.

The workspace now ships the `package-lock.json` that pins its `package.json`,
and init installs from it with `npm ci` instead of `npm install`, so a run
starts from a lockfile committed in the seed commit rather than an untracked one
left for the model to commit.
