import { describe, expect, it } from "vitest";
import type { FactorConfig } from "./factors.js";
import {
  checkRequirementFactors,
  DEFAULT_HARNESS_REQUIREMENTS_PATH,
  loadHarnessRequirements,
  parseHarnessRequirements,
} from "./harness-requirements.js";

const zone = { surfaces: ["AGENTS.md"], change: "c", why: "w" };
const requirement = { id: "verifiable-changes", factor: "test-feedback", assumption: "a", surfaces: ["AGENTS.md"], required: "r", recommended: "m", why: "w" };
const valid = {
  version: 1,
  harness: { name: "h", version: "1.0.0" },
  requirements: [requirement],
  stackDetection: { factor: "test-feedback", surfaces: ["package.json"], change: "c", why: "w" },
  zones: { red: zone, yellow: zone },
};

function errorsOf(raw: unknown): string[] {
  const result = parseHarnessRequirements(raw, "req.json");
  if (result.ok) throw new Error("expected the file to be rejected");
  return result.errors;
}

describe("default harness requirements", () => {
  it("loads seven requirements against a named harness version", () => {
    const result = loadHarnessRequirements(DEFAULT_HARNESS_REQUIREMENTS_PATH);
    if (!result.ok) throw new Error(result.errors.join("\n"));
    expect(result.value.harness).toMatchObject({ name: "ai-harness-framework", version: "0.5.0", commit: "7fb142a" });
    expect(result.value.requirements.map((r) => [r.id, r.factor])).toEqual([
      ["verifiable-changes", "test-feedback"],
      ["typed-changes", "type-strictness"],
      ["traceable-calls", "direct-api-calls"],
      ["legible-context", "file-size"],
      ["written-intent", "documented-intent"],
      ["reproducible-runs", "dev-deploy-simplicity"],
      ["supported-runtime", "dependency-currency"],
    ]);
  });
});

describe("parseHarnessRequirements", () => {
  it("accepts a minimal file", () => {
    expect(parseHarnessRequirements(valid, "req.json").ok).toBe(true);
  });

  it.each([
    ["a wrong version", { ...valid, version: 2 }, "req.json: version must be 1"],
    ["a harness without a name", { ...valid, harness: { version: "1" } }, "req.json: harness.name must be a non-empty string"],
    ["no requirements", { ...valid, requirements: [] }, "req.json: requirements must be a non-empty array"],
    ["a bad requirement id", { ...valid, requirements: [{ ...requirement, id: "Bad Id" }] }, "req.json: requirements[0].id must be a kebab-case id"],
    ["a duplicate requirement", { ...valid, requirements: [requirement, requirement] }, "req.json: requirements[1].id duplicates verifiable-changes"],
    ["empty surfaces", { ...valid, requirements: [{ ...requirement, surfaces: [] }] }, "req.json: requirements[0].surfaces must be a non-empty list of strings"],
    ["a missing change text", { ...valid, requirements: [{ ...requirement, required: "" }] }, "req.json: requirements[0].required must be a non-empty string"],
    ["an unknown requirement key", { ...valid, requirements: [{ ...requirement, severity: 1 }] }, "req.json: requirements[0] has unknown key severity"],
    ["a missing zone", { ...valid, zones: { red: zone } }, "req.json: zones.yellow must be an object"],
  ])("rejects %s", (_label, raw, expected) => {
    expect(errorsOf(raw)).toContain(expected);
  });
});

describe("checkRequirementFactors", () => {
  it("rejects requirements for factors the config does not define", () => {
    const config: FactorConfig = { version: 1, factors: [{ id: "test-feedback", name: "t", class: "blocking", description: "d" }] };
    const parsed = parseHarnessRequirements({ ...valid, requirements: [requirement, { ...requirement, id: "x", factor: "made-up" }] }, "req.json");
    if (!parsed.ok) throw new Error(parsed.errors.join("\n"));
    expect(checkRequirementFactors(parsed.value, config, "req.json")).toEqual(["req.json: requirements[1].factor made-up is not a configured factor"]);
  });
});
