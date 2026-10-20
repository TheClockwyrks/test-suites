// Tests of the workspace lockfile tool. Every case builds a throwaway package store
// and version folder, and every workspace depends on `file:` packages alone, so npm
// runs for real without reaching a registry: the registry the tests name is a
// closed local port, which any request would fail against.
//
//   npx vitest run scripts/lib/workspace-lockfiles.test.mjs

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll as after, describe, it } from "vitest";

import {
  fileSpecPath,
  generateLockfile,
  LockfileError,
  lockWorkspace,
  vendorPlan,
  versionWorkspaces,
} from "./workspace-lockfiles.mjs";

const CLI = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "workspace-lockfiles.mjs",
);
const OFFLINE = "http://127.0.0.1:9/";

const scratch = mkdtempSync(join(tmpdir(), "workspace-lockfiles-test-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

let counter = 0;
/** A fresh scratch directory. */
function tmpDir() {
  const dir = join(scratch, `case-${(counter += 1)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Write `text` (or `value` as JSON) to `path`, creating its directories. */
function write(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`,
  );
}

/**
 * A staged package store as stage-tcab-packages.mjs writes one: an engine that
 * links its contract by a relative `file:` path, the contract, and a runtime with
 * no Test Cabinet dependency.
 */
function fixtureStore({ engineVersion = "1.2.3" } = {}) {
  const store = join(tmpDir(), "store");
  write(join(store, "@clockwyrks/engine-a/package.json"), {
    name: "@clockwyrks/engine-a",
    version: engineVersion,
    type: "module",
    dependencies: { "@clockwyrks/contract-b": "file:../contract-b" },
  });
  write(join(store, "@clockwyrks/engine-a/dist/index.js"), "export {};\n");
  write(join(store, "@clockwyrks/contract-b/package.json"), {
    name: "@clockwyrks/contract-b",
    version: "0.4.0",
    type: "module",
  });
  write(join(store, "@clockwyrks/runtime-c/package.json"), {
    name: "@clockwyrks/runtime-c",
    version: "2.0.0",
    type: "module",
  });
  return store;
}

/** A workspace's package.json depending on `dependencies` alone. */
function workspacePackage(dependencies) {
  return { name: "game", version: "0.1.0", private: true, dependencies };
}

const ENGINE_SPEC = "file:./.vendor/packages/@clockwyrks/engine-a";

/**
 * A per-engine version folder: the case names a `none` and an `engine-a`
 * workspace, and its variant replaces both, sharing the `none` one.
 */
function fixtureVersion() {
  const version = join(tmpDir(), "v1.0.0");
  write(
    join(version, "test-case.toml"),
    [
      'slug = "fixture"',
      'variants = ["variants/base.toml", "variants/twist.toml"]',
      "[workspaces]",
      'none = "workspaces/none"',
      '"engine-a" = "workspaces/base/engine-a"',
      "",
    ].join("\n"),
  );
  write(join(version, "variants/base.toml"), 'slug = "base"\n');
  write(
    join(version, "variants/twist.toml"),
    [
      'slug = "twist"',
      "[workspaces]",
      'none = "workspaces/none"',
      '"engine-a" = "workspaces/twist/engine-a"',
      "",
    ].join("\n"),
  );
  write(join(version, "workspaces/none/package.json"), workspacePackage({}));
  write(join(version, "workspaces/none/src/main.ts"), "export {};\n");
  for (const name of ["base", "twist"]) {
    write(
      join(version, `workspaces/${name}/engine-a/package.json`),
      workspacePackage({ "@clockwyrks/engine-a": ENGINE_SPEC }),
    );
    write(
      join(version, `workspaces/${name}/engine-a/.gitignore`),
      "node_modules/\n",
    );
  }
  // A reference implementation is not a workspace and is never locked.
  write(
    join(version, "references/none/package.json"),
    workspacePackage({ "@clockwyrks/engine-a": "1.2.3" }),
  );
  return version;
}

describe("fileSpecPath", () => {
  it("normalizes a file: spec to a workspace-relative path", () => {
    assert.equal(
      fileSpecPath(ENGINE_SPEC),
      ".vendor/packages/@clockwyrks/engine-a",
    );
    assert.equal(fileSpecPath("file:.vendor/x/"), ".vendor/x");
    assert.equal(fileSpecPath("file:../x"), "../x");
    assert.equal(fileSpecPath("^1.0.0"), null);
  });
});

describe("versionWorkspaces", () => {
  it("collects the case's and every variant's workspaces once", () => {
    const version = fixtureVersion();
    assert.deepEqual(versionWorkspaces(version), [
      join(version, "workspaces/base/engine-a"),
      join(version, "workspaces/none"),
      join(version, "workspaces/twist/engine-a"),
    ]);
  });

  it("reads a game jam's single workspace and skips one without a package.json", () => {
    const version = join(tmpDir(), "v1.0.0");
    write(join(version, "game-jam.toml"), 'workspace = "workspaces/base"\n');
    write(join(version, "workspaces/base/package.json"), workspacePackage({}));
    assert.deepEqual(versionWorkspaces(version), [
      join(version, "workspaces/base"),
    ]);
    const bare = join(tmpDir(), "v1.0.0");
    write(join(bare, "game-jam.toml"), 'workspace = "workspaces/base"\n');
    mkdirSync(join(bare, "workspaces/base"), { recursive: true });
    assert.deepEqual(versionWorkspaces(bare), []);
  });

  it("refuses a folder with no manifest and a workspace outside the folder", () => {
    assert.throws(() => versionWorkspaces(tmpDir()), LockfileError);
    const version = join(tmpDir(), "v1.0.0");
    write(join(version, "test-case.toml"), 'workspace = "../elsewhere"\n');
    assert.throws(
      () => versionWorkspaces(version),
      /outside the version folder/,
    );
  });
});

describe("vendorPlan", () => {
  it("places a declared package and its closure beside it", () => {
    const store = fixtureStore();
    const plan = vendorPlan(
      "ws",
      workspacePackage({ "@clockwyrks/engine-a": ENGINE_SPEC }),
      store,
    );
    assert.deepEqual(Object.fromEntries(plan), {
      ".vendor/packages/@clockwyrks/engine-a": "@clockwyrks/engine-a",
      ".vendor/packages/@clockwyrks/contract-b": "@clockwyrks/contract-b",
    });
  });

  it("refuses what a workspace cannot link", () => {
    const store = fixtureStore();
    const refusals = [
      [{ "@clockwyrks/engine-a": "^1.2.3" }, /linked at a vendored path/],
      [
        { "@clockwyrks/engine-a": "file:./lib/engine-a" },
        /not under `\.vendor\/`/,
      ],
      [{ "@clockwyrks/engine-a": "file:../.vendor/engine-a" }, /not under/],
      [
        { "left-pad": "file:./.vendor/left-pad" },
        /only a Test Cabinet package/,
      ],
      [
        {
          "@clockwyrks/missing": "file:./.vendor/packages/@clockwyrks/missing",
        },
        /does not hold/,
      ],
    ];
    for (const [deps, message] of refusals) {
      assert.throws(
        () => vendorPlan("ws", workspacePackage(deps), store),
        message,
      );
    }
  });

  it("refuses a store whose packages are not linked by file: paths", () => {
    const store = fixtureStore();
    write(join(store, "@clockwyrks/engine-a/package.json"), {
      name: "@clockwyrks/engine-a",
      version: "1.2.3",
      dependencies: { "@clockwyrks/contract-b": "0.4.0" },
    });
    assert.throws(
      () =>
        vendorPlan(
          "ws",
          workspacePackage({ "@clockwyrks/engine-a": ENGINE_SPEC }),
          store,
        ),
      /stage-tcab-packages\.mjs/,
    );
  });
});

describe("generateLockfile", () => {
  it("links the declared engine and its closure at the vendored paths", () => {
    const store = fixtureStore();
    const version = fixtureVersion();
    const workspace = join(version, "workspaces/base/engine-a");
    const lock = JSON.parse(
      generateLockfile(workspace, { store, registry: OFFLINE }),
    );
    assert.equal(lock.lockfileVersion, 3);
    assert.deepEqual(lock.packages[""].dependencies, {
      "@clockwyrks/engine-a": ENGINE_SPEC,
    });
    const engine = ".vendor/packages/@clockwyrks/engine-a";
    const contract = ".vendor/packages/@clockwyrks/contract-b";
    assert.deepEqual(lock.packages["node_modules/@clockwyrks/engine-a"], {
      resolved: engine,
      link: true,
    });
    assert.equal(lock.packages[engine].version, "1.2.3");
    assert.equal(lock.packages[contract].version, "0.4.0");
    // Nothing is left in the workspace itself.
    assert.equal(existsSync(join(workspace, ".vendor")), false);
    assert.equal(existsSync(join(workspace, "package-lock.json")), false);
  });

  it("is not steered by an npm_config variable or a workspace .npmrc", () => {
    const store = fixtureStore();
    const version = fixtureVersion();
    const workspace = join(version, "workspaces/base/engine-a");
    write(join(workspace, ".npmrc"), "lockfile-version=2\n");
    const saved = process.env.npm_config_lockfile_version;
    process.env.npm_config_lockfile_version = "2";
    try {
      const lock = JSON.parse(
        generateLockfile(workspace, { store, registry: OFFLINE }),
      );
      assert.equal(lock.lockfileVersion, 3);
    } finally {
      if (saved === undefined) delete process.env.npm_config_lockfile_version;
      else process.env.npm_config_lockfile_version = saved;
    }
  });
});

describe("lockWorkspace", () => {
  it("writes a lockfile, then finds it unchanged", () => {
    const store = fixtureStore();
    const workspace = join(fixtureVersion(), "workspaces/base/engine-a");
    const options = { store, registry: OFFLINE };
    assert.equal(
      lockWorkspace(workspace, { ...options, check: true }).status,
      "missing",
    );
    assert.equal(existsSync(join(workspace, "package-lock.json")), false);
    assert.equal(lockWorkspace(workspace, options).status, "written");
    const written = readFileSync(join(workspace, "package-lock.json"), "utf8");
    assert.equal(lockWorkspace(workspace, options).status, "unchanged");
    assert.equal(
      lockWorkspace(workspace, { ...options, check: true }).status,
      "unchanged",
    );
    assert.equal(
      readFileSync(join(workspace, "package-lock.json"), "utf8"),
      written,
    );
  });

  it("reports drift when the store's version moves, and writing repairs it", () => {
    const workspace = join(fixtureVersion(), "workspaces/base/engine-a");
    lockWorkspace(workspace, { store: fixtureStore(), registry: OFFLINE });
    const moved = {
      store: fixtureStore({ engineVersion: "1.3.0" }),
      registry: OFFLINE,
    };
    assert.equal(
      lockWorkspace(workspace, { ...moved, check: true }).status,
      "drifted",
    );
    assert.equal(lockWorkspace(workspace, moved).status, "written");
    const lock = JSON.parse(
      readFileSync(join(workspace, "package-lock.json"), "utf8"),
    );
    assert.equal(
      lock.packages[".vendor/packages/@clockwyrks/engine-a"].version,
      "1.3.0",
    );
  });

  it("reports drift when package.json gains a dependency", () => {
    const store = fixtureStore();
    const workspace = join(fixtureVersion(), "workspaces/base/engine-a");
    lockWorkspace(workspace, { store, registry: OFFLINE });
    write(
      join(workspace, "package.json"),
      workspacePackage({
        "@clockwyrks/engine-a": ENGINE_SPEC,
        "@clockwyrks/runtime-c":
          "file:./.vendor/packages/@clockwyrks/runtime-c",
      }),
    );
    assert.equal(
      lockWorkspace(workspace, { store, registry: OFFLINE, check: true })
        .status,
      "drifted",
    );
  });
});

describe("the command line", () => {
  /** Run the CLI with `args`, returning its status and output. */
  function cli(...args) {
    const result = spawnSync(process.execPath, [CLI, ...args], {
      encoding: "utf8",
    });
    return { status: result.status, out: result.stdout + result.stderr };
  }

  it("writes every workspace of a version, then checks clean", () => {
    const store = fixtureStore();
    const version = fixtureVersion();
    const flags = ["--store", store, "--registry", OFFLINE];
    const check = cli(...flags, "--check", version);
    assert.equal(check.status, 1, check.out);
    assert.match(check.out, /missing: .*workspaces\/none/);
    const written = cli(...flags, version);
    assert.equal(written.status, 0, written.out);
    assert.equal((written.out.match(/^written: /gm) ?? []).length, 3);
    for (const dir of ["none", "base/engine-a", "twist/engine-a"]) {
      assert.ok(
        existsSync(join(version, "workspaces", dir, "package-lock.json")),
      );
    }
    assert.equal(
      existsSync(join(version, "references/none/package-lock.json")),
      false,
    );
    const clean = cli(...flags, "--check", version);
    assert.equal(clean.status, 0, clean.out);
    assert.equal((clean.out.match(/^unchanged: /gm) ?? []).length, 3);
  });

  it("names a workspace it cannot lock and fails", () => {
    const store = fixtureStore();
    const version = fixtureVersion();
    write(
      join(version, "workspaces/twist/engine-a/package.json"),
      workspacePackage({ "@clockwyrks/engine-a": "file:./lib/engine-a" }),
    );
    const result = cli("--store", store, "--registry", OFFLINE, version);
    assert.equal(result.status, 1, result.out);
    assert.match(result.out, /twist\/engine-a\/package\.json/);
    assert.match(result.out, /written: .*base\/engine-a/);
  });

  it("refuses a call without a store or a version", () => {
    assert.equal(cli(fixtureVersion()).status, 2);
    assert.equal(cli("--store", fixtureStore()).status, 2);
    assert.equal(
      cli("--store", join(tmpDir(), "absent"), fixtureVersion()).status,
      2,
    );
  });
});
