Introduced. A game jam on the theme **Dealer's Choice**: build an original card game
from your own designed cards — not the standard 52-card deck — that is not a reskin of,
and does not play like, well-known card games (Magic: The Gathering, Hearthstone, Slay
the Spire, Balatro, and their clones). What kind of card game it is is left open. Judged
on the generic graded review checklist.

The workspace now ships the `package-lock.json` that pins its `package.json`,
and init installs from it with `npm ci` instead of `npm install`, so a run
starts from a lockfile committed in the seed commit rather than an untracked one
left for the model to commit.
