import { describe, expect, it } from "vitest";
import { cycleFor, lowestVersion } from "./versions.js";

describe("lowestVersion", () => {
  it.each([
    ["18", "18"],
    ["v18.17.0", "18.17.0"],
    [">=14", "14"],
    [">= 14.0.0 <20", "14.0.0"],
    ["^16.0.0", "16.0.0"],
    ["~3.8", "3.8"],
    ["~>2.7", "2.7"],
    ["~=3.6", "3.6"],
    [">=3.7,<4", "3.7"],
    [">=3.6, !=3.7.*", "3.6"],
    ["==2.7.18", "2.7.18"],
    ["3.9.*", "3.9"],
    ["18.x", "18"],
    ["^7.4 || ^8.0", "7.4"],
    ["^8.1|^7.3", "7.3"],
    ["python-3.7.2", "3.7.2"],
    ["ruby-2.7.2", "2.7.2"],
    ["temurin-17.0.1+12", "17.0.1"],
    [">3.6", "3.6"],
  ])("%s → %s", (spec, expected) => {
    expect(lowestVersion(spec)).toBe(expected);
  });

  it.each([["*"], ["latest"], ["lts/*"], ["<4"], ["<=3.9"], ["!=3.7"], [""]])("%s has no lower bound", (spec) => {
    expect(lowestVersion(spec)).toBeNull();
  });
});

describe("cycleFor", () => {
  it.each([
    ["node", "18.17.0", "18"],
    ["node", "0.10.48", "0"],
    ["python", "3.10.4", "3.10"],
    ["python", "2.7", "2.7"],
    ["php", "7.4", "7.4"],
    ["ruby", "1.9.3", "1.9"],
    ["java", "1.8", "8"],
    ["java", "1.5", "5"],
    ["java", "1.4.2", "1.4"],
    ["java", "17", "17"],
  ] as const)("%s %s → cycle %s", (runtime, version, expected) => {
    expect(cycleFor(runtime, version)).toBe(expected);
  });

  it.each([["python", "3"], ["php", "8"], ["ruby", "2"]] as const)("%s %s is too coarse for a cycle", (runtime, version) => {
    expect(cycleFor(runtime, version)).toBeNull();
  });
});
