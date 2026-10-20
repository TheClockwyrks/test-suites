Introduced. A game jam on the theme **Grace Period**: a strategic, deliberate take on
the bullet-hell — a readable, telegraphed barrage of slow projectiles, a real
defensive toolkit, and windows to strike back. Judged on the generic graded review
checklist.

The workspace now ships the `package-lock.json` that pins its `package.json`,
and init installs from it with `npm ci` instead of `npm install`, so a run
starts from a lockfile committed in the seed commit rather than an untracked one
left for the model to commit.
