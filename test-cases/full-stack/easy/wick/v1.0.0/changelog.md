Introduced.

Every workspace now ships the `package-lock.json` that pins its `package.json`,
and init installs from it with `npm ci` instead of `npm install`, so a run
starts from a lockfile committed in the seed commit rather than an untracked one
left for the model to commit. The engine an engine run selects is vendored at
`.vendor/packages/`, where that engine's workspace declares it and its lockfile
links it.
