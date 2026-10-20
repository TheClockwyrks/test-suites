// Generates and checks the `package-lock.json` every starter workspace of a version
// ships.
//
// A workspace links each Test Cabinet package and engine it uses at a vendored
// `file:` path under `.vendor/`, which seeding fills from the driver's package
// store, and the run's init is `npm ci`, so the lockfile the case ships is what the
// run installs. See the Workspace, Packages and Engines sections of
// <https://docs.testcabinet.ai/testing/end-to-end/overview/>.
//
// npm cannot write that lockfile in the workspace itself: `.vendor/` is empty
// there, and this repository's `.npmrc` routes `@clockwyrks` to the private feed.
// So each workspace is copied to a directory outside this tree, the closure of
// every `@clockwyrks` package it declares is placed out of a staged package store
// (the superrepo's `scripts/stage-tcab-packages.mjs` writes one) at the path its
// `file:` spec names, exactly where seeding vendors it, and
// `npm install --package-lock-only --ignore-scripts` writes the lockfile there.
// Every other dependency resolves from the public registry. The lockfile is then
// written back beside the workspace's `package.json`, or, when checking, compared
// with the one committed.
//
// The command line is scripts/workspace-lockfiles.mjs.

import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import {
  dirname,
  isAbsolute,
  join,
  posix,
  relative,
  resolve,
  sep,
} from "node:path";

import { parse as parseToml } from "smol-toml";

/** The scope every package the store holds is published under. */
export const SCOPE = "@clockwyrks/";
/** The directory every vendored path lies under, as seeding requires. */
export const VENDOR_ROOT = ".vendor";
/** The registry every other dependency resolves from. */
export const DEFAULT_REGISTRY = "https://registry.npmjs.org/";
/** The manifests a version folder is described by, in the order looked for. */
export const VERSION_MANIFESTS = ["test-case.toml", "game-jam.toml"];
/** The dependency maps of a `package.json` a lockfile's root entry repeats. */
const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];
/** The hidden entries a workspace seeds; every other one is never seeded. */
const SEEDED_DOTFILES = new Set([".gitignore", ".cargo"]);

/** A refusal the command line prints without a stack. */
export class LockfileError extends Error {}

/** Read and parse a JSON file, naming it when it is malformed. */
function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    throw new LockfileError(`could not read ${path}: ${err.message}`);
  }
}

/** Read and parse a TOML file, naming it when it is malformed. */
function readToml(path) {
  try {
    return parseToml(readFileSync(path, "utf8"));
  } catch (err) {
    throw new LockfileError(`could not read ${path}: ${err.message}`);
  }
}

/**
 * The workspace directories a manifest table declares: the engineless spelling's
 * `workspace` and every value of the per-engine `[workspaces]` table.
 */
function declaredWorkspaces(table) {
  const dirs = [];
  if (typeof table.workspace === "string") dirs.push(table.workspace);
  if (table.workspaces && typeof table.workspaces === "object") {
    for (const dir of Object.values(table.workspaces)) {
      if (typeof dir === "string") dirs.push(dir);
    }
  }
  return dirs;
}

/**
 * Every starter workspace a version folder declares that holds a `package.json`:
 * the case's (or jam's) own, one per engine, and each variant's own, which
 * replaces it. Absolute paths, sorted, each once.
 */
export function versionWorkspaces(versionDir) {
  const root = resolve(versionDir);
  const manifestName = VERSION_MANIFESTS.find((name) =>
    existsSync(join(root, name)),
  );
  if (!manifestName) {
    throw new LockfileError(
      `${versionDir} is not a version folder: it holds none of ${VERSION_MANIFESTS.join(", ")}`,
    );
  }
  const manifest = readToml(join(root, manifestName));
  const dirs = declaredWorkspaces(manifest);
  for (const variant of manifest.variants ?? []) {
    if (typeof variant === "string") {
      dirs.push(...declaredWorkspaces(readToml(join(root, variant))));
    } else if (variant && typeof variant === "object") {
      dirs.push(...declaredWorkspaces(variant));
    }
  }
  const found = new Set();
  for (const dir of dirs) {
    const path = resolve(root, dir);
    const inside = relative(root, path);
    if (
      inside === ".." ||
      inside.startsWith(`..${sep}`) ||
      isAbsolute(inside)
    ) {
      throw new LockfileError(
        `${join(root, manifestName)} names workspace \`${dir}\`, which is outside the version folder`,
      );
    }
    if (existsSync(join(path, "package.json"))) found.add(path);
  }
  return [...found].sort();
}

/**
 * The workspace-relative directory a `file:` spec names, normalized to forward
 * slashes and without a leading `./`, or `null` for any other spec.
 */
export function fileSpecPath(spec) {
  if (typeof spec !== "string" || !spec.startsWith("file:")) return null;
  const raw = spec.slice("file:".length).replace(/\\/g, "/");
  const normalized = posix.normalize(raw).replace(/\/+$/, "");
  return normalized === "" ? "." : normalized;
}

/** Whether `path` (workspace-relative, normalized) lies under `.vendor/`. */
function isVendored(path) {
  return (
    !posix.isAbsolute(path) &&
    !path.split("/").includes("..") &&
    path.startsWith(`${VENDOR_ROOT}/`)
  );
}

/**
 * Where every `@clockwyrks` package a workspace's `package.json` declares, and
 * every one those depend on, is placed: a map from the workspace-relative path to
 * the package's name. A declared package must be a `file:` spec under `.vendor/`,
 * and the store's own `file:` links between its packages decide where the rest of
 * the closure lands, as seeding vendors it.
 */
export function vendorPlan(workspaceDir, pkg, store) {
  const placed = new Map();
  const problems = [];
  const queue = [];
  for (const field of DEPENDENCY_FIELDS) {
    for (const [name, spec] of Object.entries(pkg[field] ?? {})) {
      const path = fileSpecPath(spec);
      if (path === null) {
        if (name.startsWith(SCOPE)) {
          problems.push(
            `${field}.${name} is \`${spec}\`; a Test Cabinet package is linked at a ` +
              `vendored path, \`file:./${VENDOR_ROOT}/packages/${name}\``,
          );
        }
        continue;
      }
      if (!name.startsWith(SCOPE)) {
        problems.push(
          `${field}.${name} is \`${spec}\`; only a Test Cabinet package is linked by \`file:\``,
        );
        continue;
      }
      if (!isVendored(path)) {
        problems.push(
          `${field}.${name} is \`${spec}\`, which is not under \`${VENDOR_ROOT}/\` ` +
            `(seeding vendors it at \`file:./${VENDOR_ROOT}/packages/${name}\`)`,
        );
        continue;
      }
      queue.push({ name, path, from: `${field}.${name}` });
    }
  }
  while (queue.length > 0) {
    const { name, path, from } = queue.shift();
    const already = placed.get(path);
    if (already !== undefined) {
      if (already !== name) {
        problems.push(
          `${from} places ${name} at ${path}, where ${already} is already placed`,
        );
      }
      continue;
    }
    const source = join(store, name);
    if (!existsSync(join(source, "package.json"))) {
      problems.push(
        `${from} needs ${name}, which the package store ${store} does not hold`,
      );
      continue;
    }
    const staged = readJson(join(source, "package.json"));
    if (staged.name !== name) {
      problems.push(
        `the package store's ${name} is named \`${staged.name}\` in its package.json`,
      );
      continue;
    }
    placed.set(path, name);
    for (const [dep, spec] of Object.entries(staged.dependencies ?? {})) {
      if (!dep.startsWith(SCOPE)) continue;
      const rel = fileSpecPath(spec);
      if (rel === null) {
        problems.push(
          `the package store's ${name} depends on ${dep} by \`${spec}\` rather than a ` +
            "`file:` path; stage the store with the superrepo's scripts/stage-tcab-packages.mjs",
        );
        continue;
      }
      const depPath = posix.normalize(posix.join(path, rel));
      if (!isVendored(depPath)) {
        problems.push(
          `the package store's ${name} links ${dep} at ${depPath}, outside \`${VENDOR_ROOT}/\``,
        );
        continue;
      }
      queue.push({ name: dep, path: depPath, from: `${name} -> ${dep}` });
    }
  }
  if (problems.length > 0) {
    throw new LockfileError(
      `${join(workspaceDir, "package.json")}:\n${problems.map((p) => `  - ${p}`).join("\n")}`,
    );
  }
  return placed;
}

/**
 * Copy the files a workspace seeds into `dest`: every entry but the hidden ones
 * seeding skips, the installed `node_modules/` and a stale `.vendor/`.
 */
function copyWorkspace(workspaceDir, dest) {
  for (const entry of readdirSync(workspaceDir, { withFileTypes: true })) {
    const name = entry.name;
    if (name === "node_modules") continue;
    if (name.startsWith(".") && !SEEDED_DOTFILES.has(name)) continue;
    cpSync(join(workspaceDir, name), join(dest, name), { recursive: true });
  }
}

/**
 * The environment npm runs in: this process's, without any `npm_config_*`
 * variable, so neither a calling `npm run` nor this repository's `.npmrc` (which
 * `npm run` exports from) reaches the install.
 */
function npmEnv() {
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.toLowerCase().startsWith("npm_config_")) env[key] = value;
  }
  return env;
}

/**
 * Write the lockfile of one workspace in a scratch copy and return its text.
 * Throws a {@link LockfileError} naming the workspace when npm fails.
 */
export function generateLockfile(
  workspaceDir,
  { store, registry = DEFAULT_REGISTRY, npm = "npm" },
) {
  const pkg = readJson(join(workspaceDir, "package.json"));
  if (pkg.workspaces !== undefined) {
    throw new LockfileError(
      `${join(workspaceDir, "package.json")} declares npm workspaces, which a starter workspace does not`,
    );
  }
  const plan = vendorPlan(workspaceDir, pkg, store);
  const scratch = mkdtempSync(join(tmpdir(), "workspace-lockfile-"));
  try {
    const work = join(scratch, "workspace");
    mkdirSync(work);
    copyWorkspace(workspaceDir, work);
    rmSync(join(work, VENDOR_ROOT), { recursive: true, force: true });
    for (const [path, name] of plan) {
      const dest = join(work, ...path.split("/"));
      mkdirSync(dirname(dest), { recursive: true });
      cpSync(join(store, name), dest, { recursive: true });
    }
    // An empty user configuration beside the copy, so a developer's own
    // `~/.npmrc` (a feed, a pinned registry) cannot change what is resolved.
    const userconfig = join(scratch, "npmrc");
    writeFileSync(userconfig, "");
    const result = spawnSync(
      npm,
      [
        "install",
        "--package-lock-only",
        "--ignore-scripts",
        "--install-links=false",
        "--lockfile-version=3",
        "--no-audit",
        "--no-fund",
        `--registry=${registry}`,
        `--userconfig=${userconfig}`,
      ],
      { cwd: work, env: npmEnv(), encoding: "utf8" },
    );
    if (result.error) {
      throw new LockfileError(
        `could not run ${npm} for ${workspaceDir}: ${result.error.message}`,
      );
    }
    if (result.status !== 0) {
      throw new LockfileError(
        `npm could not lock ${workspaceDir} (exit ${result.status}):\n${result.stderr.trim()}`,
      );
    }
    return readFileSync(join(work, "package-lock.json"), "utf8");
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

/**
 * Lock one workspace. Writing, it writes the lockfile when it changed; checking,
 * it writes nothing. Returns `{ workspace, status }`, where status is
 * `unchanged`, `written` (writing) or `missing` / `drifted` (checking).
 */
export function lockWorkspace(workspaceDir, { check = false, ...options }) {
  const generated = generateLockfile(workspaceDir, options);
  const path = join(workspaceDir, "package-lock.json");
  const committed = existsSync(path) ? readFileSync(path, "utf8") : null;
  if (committed === generated)
    return { workspace: workspaceDir, status: "unchanged" };
  if (check) {
    return {
      workspace: workspaceDir,
      status: committed === null ? "missing" : "drifted",
    };
  }
  writeFileSync(path, generated);
  return { workspace: workspaceDir, status: "written" };
}

/** Whether `path` is a directory. */
export function isDirectory(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}
