Introduced. A game jam on the theme **Band of Bots**: a single-player battle royale at
scale, where the player leads a squad of AI teammates directed through a natural,
low-friction coordination UI, and every other combatant is AI. How the battle royale
plays is left open. Judged on the generic graded review checklist.

The workspace now ships the `package-lock.json` that pins its `package.json`,
and init installs from it with `npm ci` instead of `npm install`, so a run
starts from a lockfile committed in the seed commit rather than an untracked one
left for the model to commit.
