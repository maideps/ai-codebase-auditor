import { describe, expect, it } from "vitest";
import { DEFAULT_DECISION_CONFIG_PATH, loadDecisionConfig, type DecisionConfig } from "../config/decision.js";
import { DEFAULT_CONFIG_PATH, loadFactorConfig } from "../config/factors.js";
import type { Scoring } from "../scoring/types.js";
import { collected, notMeasured, structureOf, testsDocsOf } from "../testing/collected.js";
import { assignZones, redTermIn } from "./zones.js";

const decisionLoaded = loadDecisionConfig(DEFAULT_DECISION_CONFIG_PATH);
const factorsLoaded = loadFactorConfig(DEFAULT_CONFIG_PATH);
if (!decisionLoaded.ok || !factorsLoaded.ok) throw new Error("default config does not load");
const decision = decisionLoaded.value;
const factors = factorsLoaded.value;

// Scoring with only the test-feedback base score that zones read.
function scoringWithTests(baseScore: number | null): Scoring {
  return {
    factors: [{
      id: "test-feedback", name: "t", class: "blocking", status: baseScore === null ? "not-measured" : "scored",
      score: baseScore, baseScore, rule: null, evidence: [], partial: null, reason: null, deferral: null,
    }],
    readiness: { level: baseScore, setBy: "test-feedback", provisional: false, unmeasuredBlocking: [] },
  };
}

const files = (paths: string[], lines = 10) => paths.map((path) => ({ path, lines }));

describe("redTermIn", () => {
  it.each([
    ["web/app/Auth/Guard.php", "auth"],
    ["web/app/Http/Controllers/ForgotPasswordController.php", "password"],
    ["lib/billing/charge.rb", "billing"],
    ["app/models/role.rb", "role"],
    ["src/permissions.ts", "permissions"],
    ["src/oauth2/client.py", "oauth"],
    ["src/StripeWebhook.java", "stripe"],
  ])("%s is red for %s", (path, term) => {
    expect(redTermIn(path, decision.redTerms)).toBe(term);
  });

  it.each([["session-handoff.md"], ["web/app/Actions/BookSession.php"], ["src/invoice_intake/api.py"], ["src/author.ts"], ["src/rolex.ts"]])(
    "%s is not red",
    (path) => {
      expect(redTermIn(path, decision.redTerms)).toBeNull();
    },
  );
});

describe("assignZones", () => {
  it("makes legible modules green when tests score at least 3, and names red paths, collapsing red directories", () => {
    const results = collected({
      // src holds 3 of 7 source files, so no module is over half and nothing splits.
      structure: structureOf(files(["src/app.ts", "src/auth/login.ts", "src/auth/session.ts", "lib/util.rb", "lib/billing.rb", "lib/x.rb", "lib/y.rb", "README.md"])),
      testsDocs: testsDocsOf(),
    });
    expect(assignZones(scoringWithTests(3), results, factors, decision)).toEqual({
      modules: [
        { module: "lib", zone: "green", reason: "test-feedback 3 ≥ 3 and files are legible (p90 10 lines, 0% over 1000 lines)", sourceFiles: 4, redFiles: 1 },
        { module: "src", zone: "green", reason: "test-feedback 3 ≥ 3 and files are legible (p90 10 lines, 0% over 1000 lines)", sourceFiles: 3, redFiles: 2 },
      ],
      redPaths: [
        { path: "lib/billing.rb", kind: "file", term: "billing" },
        { path: "src/auth", kind: "directory", term: "auth" },
      ],
      unzoned: ["(root)"],
      note: null,
    });
  });

  it("makes every module yellow when tests score below 3", () => {
    const results = collected({ structure: structureOf(files(["src/a.ts", "lib/b.ts"])), testsDocs: testsDocsOf() });
    expect(assignZones(scoringWithTests(2), results, factors, decision).modules.map((m) => [m.module, m.zone, m.reason])).toEqual([
      ["lib", "yellow", "test-feedback 2 < 3: add characterization tests before agents edit"],
      ["src", "yellow", "test-feedback 2 < 3: add characterization tests before agents edit"],
    ]);
  });

  it("makes a module yellow when its files exceed the file-size score-3 limits", () => {
    // p90 of 10 files is the 9th value; 801 lines is just over the score-3 limit of 800.
    const big = [...files(Array.from({ length: 8 }, (_, i) => `big/f${i}.py`)), ...files(["big/x.py", "big/y.py"], 801)];
    const results = collected({ structure: structureOf([...big, ...files(["ok/a.py"])]), testsDocs: testsDocsOf() });
    const zones = assignZones(scoringWithTests(5), results, factors, decision);
    expect(zones.modules.find((m) => m.module === "big")).toMatchObject({
      zone: "yellow",
      reason: "files too large for unsupervised edits: p90 801 lines > 800",
    });
    expect(zones.modules.find((m) => m.module === "ok")?.zone).toBe("green");
  });

  it("makes a module red when all its source files are red", () => {
    const results = collected({ structure: structureOf(files(["auth/a.ts", "auth/b.ts", "src/c.ts"])), testsDocs: testsDocsOf() });
    expect(assignZones(scoringWithTests(4), results, factors, decision).modules.find((m) => m.module === "auth")).toEqual({
      module: "auth", zone: "red", reason: "every source file is on a red path: agents may only propose changes", sourceFiles: 2, redFiles: 2,
    });
  });

  it("splits a module holding more than half of the source files, down to the depth limit", () => {
    const paths = [
      ...Array.from({ length: 6 }, (_, i) => `web/app/models/m${i}.php`),
      ...Array.from({ length: 3 }, (_, i) => `web/app/http/c${i}.php`),
      "web/routes/r.php",
      "web/index.php",
      "lib/x.php",
    ];
    const zones = assignZones(scoringWithTests(4), collected({ structure: structureOf(files(paths)), testsDocs: testsDocsOf() }), factors, decision);
    // web (11 of 12) splits; web/app (9 of 12) splits; web/app/models (6 of 12) is not over half.
    expect(zones.modules.map((m) => [m.module, m.sourceFiles])).toEqual([
      ["lib", 1],
      ["web/(files)", 1],
      ["web/app/http", 3],
      ["web/app/models", 6],
      ["web/routes", 1],
    ]);
  });

  it("stops splitting at the depth limit", () => {
    const deep: DecisionConfig = { ...decision, maxDepth: 1 };
    const paths = [...Array.from({ length: 5 }, (_, i) => `web/app/m${i}.php`), "lib/x.php"];
    const zones = assignZones(scoringWithTests(4), collected({ structure: structureOf(files(paths)), testsDocs: testsDocsOf() }), factors, deep);
    expect(zones.modules.map((m) => m.module)).toEqual(["lib", "web"]);
  });

  it("leaves test files out of module zones", () => {
    const results = collected({
      structure: structureOf(files(["src/a.ts", "test/a.test.ts"])),
      testsDocs: testsDocsOf({ testFiles: ["test/a.test.ts"] }),
    });
    const zones = assignZones(scoringWithTests(4), results, factors, decision);
    expect(zones.modules.map((m) => m.module)).toEqual(["src"]);
    expect(zones.unzoned).toEqual(["test"]);
  });

  it("explains when zones cannot be assigned", () => {
    const zones = assignZones(scoringWithTests(4), collected({ structure: notMeasured("git failed: x") }), factors, decision);
    expect(zones).toEqual({ modules: [], redPaths: [], unzoned: [], note: "no zones: code structure not measured (git failed: x)" });
  });
});
