import { describe, expect, it } from "vitest";
import { readVersion, runCli, USAGE } from "./cli.js";

describe("runCli", () => {
  it("prints usage when called without arguments", () => {
    expect(runCli([], "1.2.3")).toEqual({ exitCode: 0, stdout: USAGE, stderr: "" });
  });

  it("prints usage for --help and -h", () => {
    expect(runCli(["--help"], "1.2.3").stdout).toBe(USAGE);
    expect(runCli(["-h"], "1.2.3").stdout).toBe(USAGE);
  });

  it("prints the version for --version and -v", () => {
    expect(runCli(["--version"], "1.2.3")).toEqual({ exitCode: 0, stdout: "1.2.3\n", stderr: "" });
    expect(runCli(["-v"], "1.2.3").stdout).toBe("1.2.3\n");
  });

  it("rejects an unknown argument with exit code 2 on stderr", () => {
    const result = runCli(["--nope"], "1.2.3");
    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Unknown argument: --nope");
  });
});

describe("readVersion", () => {
  it("reads a semver version from package.json", () => {
    expect(readVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });
});
