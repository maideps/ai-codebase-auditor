import { describe, expect, it } from "vitest";
import { DEFAULT_EOL_TABLE_PATH, loadRuntimeEolTable, parseRuntimeEolTable } from "./runtime-eol.js";

const valid = {
  version: 1,
  asOf: "2026-10-21",
  note: "n",
  runtimes: { node: { source: "https://endoflife.date/nodejs", cycles: [{ cycle: "18", eol: "2025-04-30" }] } },
};

function errorsOf(raw: unknown): string[] {
  const result = parseRuntimeEolTable(raw, "eol.json");
  if (result.ok) throw new Error("expected the table to be rejected");
  return result.errors;
}

describe("default runtime EOL table", () => {
  it("loads all five runtimes with a dated asOf", () => {
    const result = loadRuntimeEolTable(DEFAULT_EOL_TABLE_PATH);
    if (!result.ok) throw new Error(result.errors.join("\n"));
    expect(Object.keys(result.value.runtimes).sort()).toEqual(["java", "node", "php", "python", "ruby"]);
    expect(result.value.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.value.runtimes.python?.cycles.find((c) => c.cycle === "2.7")?.eol).toBe("2020-01-01");
  });
});

describe("parseRuntimeEolTable", () => {
  it("accepts a minimal table", () => {
    expect(parseRuntimeEolTable(valid, "eol.json").ok).toBe(true);
  });

  it.each([
    ["a wrong version", { ...valid, version: 2 }, "eol.json: version must be 1"],
    ["a bad asOf", { ...valid, asOf: "Oct 2026" }, "eol.json: asOf must be a YYYY-MM-DD date"],
    ["an unknown runtime", { ...valid, runtimes: { cobol: valid.runtimes.node } }, "eol.json: runtimes.cobol is not a known runtime"],
    ["a missing source", { ...valid, runtimes: { node: { cycles: [] } } }, "eol.json: runtimes.node.source must be a non-empty string"],
    [
      "a bad eol date",
      { ...valid, runtimes: { node: { source: "s", cycles: [{ cycle: "18", eol: "soon" }] } } },
      "eol.json: runtimes.node.cycles[0].eol must be a YYYY-MM-DD date",
    ],
    [
      "a duplicate cycle",
      { ...valid, runtimes: { node: { source: "s", cycles: [{ cycle: "18", eol: "2025-04-30" }, { cycle: "18", eol: "2025-04-30" }] } } },
      "eol.json: runtimes.node.cycles[1].cycle duplicates 18",
    ],
  ])("rejects %s", (_label, raw, expected) => {
    expect(errorsOf(raw)).toContain(expected);
  });
});
