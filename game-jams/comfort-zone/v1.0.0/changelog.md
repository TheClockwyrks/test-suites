Introduced. A game jam on the theme **Comfort Zone**: build a cozy game — a warm,
low-pressure little world a player sinks into — capturing the calm, unhurried,
charming feeling of games like Stardew Valley. What the player does in the world is
left open. Judged on the generic graded review checklist.

The workspace now ships the `package-lock.json` that pins its `package.json`,
and init installs from it with `npm ci` instead of `npm install`, so a run
starts from a lockfile committed in the seed commit rather than an untracked one
left for the model to commit.
