import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkDeferralFactors, loadDeferrals, parseDeferrals } from "./deferrals.js";
import type { FactorConfig } from "./factors.js";

const entry = { factor: "type-strictness", recorded: "2026-09-01", reason: "migrating to TypeScript", revisitBy: "2027-03-31" };

function errorsOf(raw: unknown): string[] {
  const result = parseDeferrals(raw, "deferrals.json");
  if (result.ok) throw new Error("expected the file to be rejected");
  return result.errors;
}

describe("parseDeferrals", () => {
  it("accepts deferrals with and without a revisit date", () => {
    const withoutRevisit = { factor: entry.factor, recorded: entry.recorded, reason: entry.reason };
    expect(parseDeferrals({ version: 1, deferrals: [entry, withoutRevisit] }, "deferrals.json")).toEqual({
      ok: true,
      value: [entry, withoutRevisit],
    });
  });

  it.each([
    ["a wrong version", { version: 2, deferrals: [] }, "deferrals.json: version must be 1"],
    ["a missing list", { version: 1 }, "deferrals.json: deferrals must be an array"],
    ["a bad factor id", { version: 1, deferrals: [{ ...entry, factor: "Type Strictness" }] }, "deferrals.json: deferrals[0].factor must be a kebab-case factor id"],
    ["an undated deferral", { version: 1, deferrals: [{ ...entry, recorded: "last week" }] }, "deferrals.json: deferrals[0].recorded must be a YYYY-MM-DD date"],
    ["a missing reason", { version: 1, deferrals: [{ ...entry, reason: " " }] }, "deferrals.json: deferrals[0].reason must be a non-empty string"],
    ["a bad revisit date", { version: 1, deferrals: [{ ...entry, revisitBy: "soon" }] }, "deferrals.json: deferrals[0].revisitBy must be a YYYY-MM-DD date"],
    ["a revisit date before the record date", { version: 1, deferrals: [{ ...entry, revisitBy: "2026-08-01" }] }, "deferrals.json: deferrals[0].revisitBy is before recorded"],
    ["an unknown key", { version: 1, deferrals: [{ ...entry, until: "2027-01-01" }] }, "deferrals.json: deferrals[0] has unknown key until"],
  ])("rejects %s", (_label, raw, expected) => {
    expect(errorsOf(raw)).toContain(expected);
  });
});

describe("checkDeferralFactors", () => {
  const config: FactorConfig = { version: 1, factors: [{ id: "type-strictness", name: "Types", class: "blocking", description: "d" }] };

  it("rejects deferrals for factors the config does not define", () => {
    expect(checkDeferralFactors([entry, { ...entry, factor: "made-up" }], config, "deferrals.json")).toEqual([
      "deferrals.json: deferrals[1].factor made-up is not a configured factor",
    ]);
  });
});

describe("loadDeferrals", () => {
  it("reads a file and reports a missing one", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "aca-deferrals-"));
    const file = path.join(dir, "deferrals.json");
    writeFileSync(file, JSON.stringify({ version: 1, deferrals: [entry] }), "utf8");
    expect(loadDeferrals(file)).toEqual({ ok: true, value: [entry] });
    expect(loadDeferrals(path.join(dir, "nope.json"))).toEqual({ ok: false, errors: [`${path.join(dir, "nope.json")}: file not found`] });
  });
});
