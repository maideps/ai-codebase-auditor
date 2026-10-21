import { describe, expect, it } from "vitest";
import { DEFAULT_DECISION_CONFIG_PATH, loadDecisionConfig, parseDecisionConfig } from "./decision.js";

const valid = { version: 1, weakMax: 2, greenMinTestScore: 3, splitShare: 0.5, maxDepth: 3, redTerms: ["auth", "billing"] };

function errorsOf(raw: unknown): string[] {
  const result = parseDecisionConfig(raw, "decision.json");
  if (result.ok) throw new Error("expected the config to be rejected");
  return result.errors;
}

describe("decision config", () => {
  it("loads the default config with auth, billing and permission terms but not session or invoice", () => {
    const result = loadDecisionConfig(DEFAULT_DECISION_CONFIG_PATH);
    if (!result.ok) throw new Error(result.errors.join("\n"));
    expect(result.value).toMatchObject({ version: 1, weakMax: 2, greenMinTestScore: 3, splitShare: 0.5, maxDepth: 3 });
    expect(result.value.redTerms).toEqual(expect.arrayContaining(["auth", "billing", "permission", "role", "password"]));
    expect(result.value.redTerms).not.toContain("session");
    expect(result.value.redTerms).not.toContain("invoice");
  });

  it("accepts a valid config", () => {
    expect(parseDecisionConfig(valid, "decision.json")).toEqual({ ok: true, value: valid });
  });

  it.each([
    ["a wrong version", { ...valid, version: 2 }, "decision.json: version must be 1"],
    ["a weakMax outside 1-4", { ...valid, weakMax: 5 }, "decision.json: weakMax must be a whole number from 1 to 4"],
    ["a fractional greenMinTestScore", { ...valid, greenMinTestScore: 2.5 }, "decision.json: greenMinTestScore must be a whole number from 1 to 5"],
    ["a splitShare of 0", { ...valid, splitShare: 0 }, "decision.json: splitShare must be above 0 and at most 1"],
    ["a maxDepth of 0", { ...valid, maxDepth: 0 }, "decision.json: maxDepth must be a whole number of at least 1"],
    ["an empty term list", { ...valid, redTerms: [] }, "decision.json: redTerms must be a non-empty array"],
    ["an upper-case term", { ...valid, redTerms: ["Auth"] }, "decision.json: redTerms[0] must be a lower-case word"],
    ["a duplicate term", { ...valid, redTerms: ["auth", "auth"] }, "decision.json: redTerms[1] duplicates auth"],
    ["an unknown key", { ...valid, greenTests: 3 }, "decision.json: unknown key greenTests"],
  ])("rejects %s", (_label, raw, expected) => {
    expect(errorsOf(raw)).toContain(expected);
  });
});
