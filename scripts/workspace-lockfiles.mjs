#!/usr/bin/env node
// Writes, or checks, the `package-lock.json` of every starter workspace a version
// declares: the case's or jam's own, one per engine, and each variant's own.
//
//   node scripts/workspace-lockfiles.mjs --store <store> <version-folder>...
//   node scripts/workspace-lockfiles.mjs --store <store> --check <version-folder>...
//
// <store> is a staged package store. In the superrepo, after `npm ci`:
//
//   node scripts/stage-tcab-packages.mjs /tmp/tcab-packages
//
// Writing, it rewrites each lockfile that changed. With `--check` it writes
// nothing and exits non-zero naming every workspace whose lockfile is missing or
// differs from what writing would produce. `--registry <url>` names the registry
// every dependency but the store's resolves from (default the public npm
// registry). See scripts/lib/workspace-lockfiles.mjs for how a lockfile is made,
// and the authoring guide for when to run it:
// <https://docs.testcabinet.ai/guides/authoring/authoring-a-full-stack-test-case/>.

import { resolve } from "node:path";
import { parseArgs } from "node:util";

import {
  DEFAULT_REGISTRY,
  isDirectory,
  LockfileError,
  lockWorkspace,
  versionWorkspaces,
} from "./lib/workspace-lockfiles.mjs";

const USAGE =
  "usage: node scripts/workspace-lockfiles.mjs --store <store> [--check] " +
  "[--registry <url>] <version-folder>...";

function main(argv) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        store: { type: "string" },
        check: { type: "boolean", default: false },
        registry: { type: "string", default: DEFAULT_REGISTRY },
        help: { type: "boolean", short: "h", default: false },
      },
    });
  } catch (err) {
    console.error(`${err.message}\n${USAGE}`);
    return 2;
  }
  const { values, positionals } = parsed;
  if (values.help) {
    console.log(USAGE);
    return 0;
  }
  if (!values.store || positionals.length === 0) {
    console.error(USAGE);
    return 2;
  }
  const store = resolve(values.store);
  if (!isDirectory(store)) {
    console.error(`the package store ${store} is not a directory`);
    return 2;
  }

  let failed = 0;
  for (const version of positionals) {
    let workspaces;
    try {
      workspaces = versionWorkspaces(version);
    } catch (err) {
      if (!(err instanceof LockfileError)) throw err;
      console.error(`error: ${err.message}`);
      failed += 1;
      continue;
    }
    if (workspaces.length === 0) {
      console.log(`${version}: no workspace with a package.json`);
      continue;
    }
    for (const workspace of workspaces) {
      try {
        const { status } = lockWorkspace(workspace, {
          check: values.check,
          store,
          registry: values.registry,
        });
        console.log(`${status}: ${workspace}`);
        if (status === "missing" || status === "drifted") failed += 1;
      } catch (err) {
        if (!(err instanceof LockfileError)) throw err;
        console.error(`error: ${err.message}`);
        failed += 1;
      }
    }
  }
  if (failed > 0) {
    console.error(
      values.check
        ? `${failed} workspace lockfile(s) missing, drifted or not lockable; ` +
            "write them with the same command without --check"
        : `${failed} workspace(s) could not be locked`,
    );
    return 1;
  }
  return 0;
}

process.exitCode = main(process.argv.slice(2));
