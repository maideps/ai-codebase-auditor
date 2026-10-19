import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG_PATH, loadFactorConfig, parseFactorConfig } from "./factors.js";

const factor = (overrides: Record<string, unknown> = {}) => ({
  id: "test-feedback",
  name: "Test presence and feedback speed",
  class: "blocking",
  description: "Tests exist and run quickly.",
  ...overrides,
});

function errorsOf(raw: unknown): string[] {
  const result = parseFactorConfig(raw, "factors.json");
  if (result.ok) throw new Error("expected the config to be rejected");
  return result.errors;
}

describe("default config", () => {
  it("loads nine factors, three of them blocking", () => {
    const result = loadFactorConfig(DEFAULT_CONFIG_PATH);
    if (!result.ok) throw new Error(result.errors.join("\n"));
    expect(result.value.factors).toHaveLength(9);
    expect(result.value.factors.filter((f) => f.class === "blocking").map((f) => f.id)).toEqual([
      "test-feedback",
      "type-strictness",
      "direct-api-calls",
    ]);
  });
});

describe("parseFactorConfig", () => {
  it("accepts a minimal valid config", () => {
    const result = parseFactorConfig({ version: 1, factors: [factor()] }, "factors.json");
    expect(result).toEqual({ ok: true, value: { version: 1, factors: [factor()] } });
  });

  it.each([
    ["a non-object root", [], "factors.json: must be a JSON object"],
    ["a wrong version", { version: 2, factors: [factor()] }, "factors.json: version must be 1"],
    ["a missing factors array", { version: 1 }, "factors.json: factors must be a non-empty array"],
    ["an empty factors array", { version: 1, factors: [] }, "factors.json: factors must be a non-empty array"],
    ["a non-object factor", { version: 1, factors: [factor(), "x"] }, "factors.json: factors[1] must be an object"],
    ["a missing id", { version: 1, factors: [factor({ id: undefined })] }, "factors.json: factors[0].id must be a kebab-case string"],
    ["a non-kebab id", { version: 1, factors: [factor({ id: "Test_Feedback" })] }, "factors.json: factors[0].id must be a kebab-case string"],
    ["an empty name", { version: 1, factors: [factor({ name: " " })] }, "factors.json: factors[0].name must be a non-empty string"],
    ["an unknown class", { version: 1, factors: [factor({ class: "soft" })] }, 'factors.json: factors[0].class must be "blocking" or "constraining"'],
    ["a missing description", { version: 1, factors: [factor({ description: undefined })] }, "factors.json: factors[0].description must be a non-empty string"],
    ["an unknown key", { version: 1, factors: [factor({ clas: "blocking" })] }, "factors.json: factors[0] has unknown key clas"],
    ["an unknown root key", { version: 1, factors: [factor()], extra: true }, "factors.json: unknown key extra"],
  ])("rejects %s", (_label, raw, expected) => {
    expect(errorsOf(raw)).toContain(expected);
  });

  it("rejects duplicate ids", () => {
    expect(errorsOf({ version: 1, factors: [factor(), factor()] })).toContain(
      "factors.json: factors[1].id duplicates test-feedback",
    );
  });

  it("requires at least one blocking factor", () => {
    expect(errorsOf({ version: 1, factors: [factor({ class: "constraining" })] })).toContain(
      "factors.json: at least one factor must be blocking",
    );
  });

  it("reports every problem, not only the first", () => {
    const errors = errorsOf({ version: 3, factors: [factor({ name: "" }), factor({ id: "x", class: "?" })] });
    expect(errors).toEqual([
      "factors.json: version must be 1",
      "factors.json: factors[0].name must be a non-empty string",
      'factors.json: factors[1].class must be "blocking" or "constraining"',
    ]);
  });
});

describe("loadFactorConfig", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "aca-config-"));

  it("reports a missing file", () => {
    const missing = path.join(dir, "missing.json");
    expect(loadFactorConfig(missing)).toEqual({ ok: false, errors: [`${missing}: file not found`] });
  });

  it("reports invalid JSON", () => {
    const broken = path.join(dir, "broken.json");
    writeFileSync(broken, "{ not json", "utf8");
    const result = loadFactorConfig(broken);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/^.*broken\.json: invalid JSON/);
  });
});
