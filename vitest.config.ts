// The workspace's tests: every tool's own suite, each run as a vitest project
// under the tool's own configuration, and the content gates' own scripts under
// scripts/, so one run from the root covers them all and writes one report.
//
// The projects are named rather than globbed, so a directory under tools/ that
// is not a package is no project.
//
// Given CI_GATE_ARTIFACTS (the typescript gate sets it), the run writes the JUnit
// report and the coverage summary into that directory, as ci/README.md names
// them; without it, it writes neither.
import { defineConfig } from "vitest/config";

const artifacts = process.env.CI_GATE_ARTIFACTS;

export default defineConfig({
  test: {
    projects: [
      "tools/lattice-designer/vitest.config.ts",
      {
        test: {
          name: "scripts",
          environment: "node",
          include: ["scripts/**/*.test.mjs"],
        },
      },
    ],
    ...(artifacts
      ? {
          reporters: ["default", "junit"],
          outputFile: { junit: `${artifacts}/junit.xml` },
          coverage: {
            enabled: true,
            provider: "v8",
            reporter: ["json-summary"],
            reportsDirectory: artifacts,
            include: ["tools/*/src/**/*.{ts,tsx}", "scripts/**/*.mjs"],
          },
        }
      : {}),
  },
});
