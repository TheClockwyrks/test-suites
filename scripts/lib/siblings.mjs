// The files two content gates read from another repository of the project.
//
// The catalog is judged against two things it does not hold. `spec-vocabulary`
// reads the shared prompt wording the suites crate of `contracts` prepends to a
// seeded prompt (`crates/suites/src/prompt.rs`), and `audio-packs` resolves every
// `[audio] packs` ref against the sample packs `microservice-backend` publishes
// (`containers/sample-packs/`), through that repository's own clip store module
// (`scripts/lib/audio-store.mjs`), so the hashing that names a published clip has
// one source. No manifest can name either, so neither is a build edge: the sample
// packs are the data edge `test-suites -> microservice-backend` the Repositories
// development page records.
//
// A repository is found in this order:
//
//   1. the directory its environment variable names (`TCAB_CONTRACTS_DIR`,
//      `TCAB_BACKEND_DIR`), for a checkout kept anywhere else;
//   2. its checkout in the superrepo this checkout is a submodule of, where
//      `contracts` sits beside `test-suites` and the backend is still a directory
//      of the superrepo's own tree;
//   3. otherwise a shallow, sparse clone of its public mirror's `master`, holding
//      the named paths alone, made under `node_modules/.cache/siblings/` on every
//      run. That is how the pipeline, which checks this repository out on its own,
//      reads them. It sits under the workspace's `node_modules` so a module read
//      from it resolves its own imports (`smol-toml`) from this workspace.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** This checkout's root (the parent of `scripts/`). */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Each repository a gate reads, with where to find it: the variable naming a
 * checkout of it, its place relative to the superrepo's root, its public mirror,
 * and the paths a gate reads from it, which a clone checks out alone.
 */
export const SIBLINGS = {
  contracts: {
    env: "TCAB_CONTRACTS_DIR",
    superrepo: "contracts",
    mirror: "https://github.com/TheClockwyrks/contracts",
    paths: ["crates/suites/src/prompt.rs"],
  },
  // The backend is not extracted yet, so its mirror is the superrepo's own.
  "microservice-backend": {
    env: "TCAB_BACKEND_DIR",
    superrepo: ".",
    mirror: "https://github.com/TheClockwyrks/TheTestCabinet",
    paths: ["containers/sample-packs", "scripts/lib/audio-store.mjs"],
  },
};

/** Whether every one of `paths` exists under `root`. */
const holds = (root, paths) => paths.every((path) => existsSync(join(root, path)));

/**
 * The root of the named repository's checkout, found as the header says. Throws
 * with what to do when none is reachable.
 */
export function siblingRoot(name, { root = ROOT, env = process.env } = {}) {
  const sibling = SIBLINGS[name];
  if (sibling === undefined) throw new Error(`no sibling repository ${name}`);

  const named = env[sibling.env];
  if (named) {
    if (!holds(named, sibling.paths)) {
      throw new Error(
        `${sibling.env}=${named} holds none of ${sibling.paths.join(", ")}`,
      );
    }
    return resolve(named);
  }

  const inSuperrepo = resolve(root, "..", sibling.superrepo);
  if (holds(inSuperrepo, sibling.paths)) return inSuperrepo;

  const clone = join(root, "node_modules", ".cache", "siblings", name);
  rmSync(clone, { recursive: true, force: true });
  mkdirSync(dirname(clone), { recursive: true });
  const git = (...args) =>
    execFileSync("git", args, { stdio: ["ignore", "ignore", "inherit"] });
  try {
    git(
      "clone",
      "--quiet",
      "--depth",
      "1",
      "--filter=blob:none",
      "--sparse",
      "--branch",
      "master",
      sibling.mirror,
      clone,
    );
    // A leading slash anchors each path, as non-cone mode asks of a single file.
    git(
      "-C",
      clone,
      "sparse-checkout",
      "set",
      "--no-cone",
      ...sibling.paths.map((path) => `/${path}`),
    );
  } catch (error) {
    throw new Error(
      `could not clone ${sibling.mirror} for ${sibling.paths.join(", ")} ` +
        `(${error.message}). Set ${sibling.env} to a checkout of ${name}.`,
    );
  }
  if (!holds(clone, sibling.paths)) {
    throw new Error(
      `${sibling.mirror} at master holds none of ${sibling.paths.join(", ")}; ` +
        "if they moved, update scripts/lib/siblings.mjs",
    );
  }
  return clone;
}

/**
 * The backend's clip store module, `scripts/lib/audio-store.mjs`, imported from
 * wherever `siblingRoot` finds the backend. Its `PACKS_DIR` and
 * `OBJECTS_LOCK_PATH` name the backend's `containers/sample-packs/`.
 */
export async function loadAudioStore(options) {
  const backend = siblingRoot("microservice-backend", options);
  return import(
    pathToFileURL(join(backend, "scripts", "lib", "audio-store.mjs")).href
  );
}
