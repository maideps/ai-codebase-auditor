// SARIF 2.1.0 rendering of a report, for code-scanning tools in CI. One result per
// weak factor, yellow module, yellow path and red path, each with its evidence.
// Same report, same bytes.

import type { AuditReport } from "./model.js";

export const SARIF_SCHEMA = "https://json.schemastore.org/sarif-2.1.0.json";
export const INFORMATION_URI = "https://github.com/maideps/ai-codebase-auditor";

type Level = "error" | "warning" | "note";

interface Rule {
  id: string;
  name: string;
  shortDescription: { text: string };
  fullDescription: { text: string };
  defaultConfiguration: { level: Level };
  helpUri: string;
}

interface SarifResult {
  ruleId: string;
  ruleIndex: number;
  level: Level;
  message: { text: string };
  locations?: { physicalLocation: { artifactLocation: { uri: string; uriBaseId: "%SRCROOT%" } } }[];
}

const location = (uri: string) => [{ physicalLocation: { artifactLocation: { uri, uriBaseId: "%SRCROOT%" as const } } }];
// A rule id is PascalCase-free: "factor/test-feedback", "zone/red-path".
const ZONE_RULES: Record<"yellow-module" | "yellow-path" | "red-path", Omit<Rule, "id" | "helpUri">> = {
  "yellow-module": {
    name: "YellowModule",
    shortDescription: { text: "Module needs characterization tests before agents edit it" },
    fullDescription: { text: "Tests or file sizes in this module are below what unsupervised agent edits need; pin its current behavior with characterization tests first." },
    defaultConfiguration: { level: "warning" },
  },
  "yellow-path": {
    name: "YellowPath",
    shortDescription: { text: "Hotspot with no test named after it" },
    fullDescription: { text: "A long, often-changed file inside a green module with no test named after it; write characterization tests before agents edit it." },
    defaultConfiguration: { level: "warning" },
  },
  "red-path": {
    name: "RedPath",
    shortDescription: { text: "Agents may only propose changes here" },
    fullDescription: { text: "Auth, billing, permission, secret or similar code: every change needs human review, so agents propose diffs instead of editing." },
    defaultConfiguration: { level: "note" },
  },
};

/** Renders the report as SARIF 2.1.0; a factor is weak at or below weakMax. */
export function renderSarif(report: AuditReport, weakMax: number): string {
  const rules: Rule[] = [];
  const results: SarifResult[] = [];
  const ruleIndex = (id: string, make: () => Omit<Rule, "id" | "helpUri">): number => {
    const existing = rules.findIndex((rule) => rule.id === id);
    if (existing >= 0) return existing;
    rules.push({ id, ...make(), helpUri: `${INFORMATION_URI}/blob/main/docs/USAGE.md` });
    return rules.length - 1;
  };

  for (const factor of report.factors) {
    if (factor.score === null || factor.score > weakMax) continue;
    const id = `factor/${factor.id}`;
    const level: Level = factor.class === "blocking" ? "error" : "warning";
    const index = ruleIndex(id, () => ({
      name: factor.name,
      shortDescription: { text: `Weak ${factor.class} factor: ${factor.name}` },
      fullDescription: { text: `${factor.id} scores at or below ${weakMax} of 5. A weak blocking factor limits readiness; a weak constraining factor needs an adaptation.` },
      defaultConfiguration: { level },
    }));
    const evidence = factor.evidence.length > 0 ? ` Evidence: ${factor.evidence.join("; ")}.` : "";
    results.push({ ruleId: id, ruleIndex: index, level, message: { text: `${factor.id} ${factor.score} (${factor.class}): ${factor.rule ?? "no rule"}.${evidence}` } });
  }
  for (const module of report.zones.modules.filter((m) => m.zone === "yellow")) {
    const index = ruleIndex("zone/yellow-module", () => ZONE_RULES["yellow-module"]);
    const uri = module.module === "(root)" ? "." : `${module.module.replace(/\/\(files\)$/, "")}/`;
    results.push({ ruleId: "zone/yellow-module", ruleIndex: index, level: "warning", message: { text: `${module.module} is yellow: ${module.reason}` }, locations: location(uri) });
  }
  for (const yellow of report.zones.yellowPaths) {
    const index = ruleIndex("zone/yellow-path", () => ZONE_RULES["yellow-path"]);
    results.push({ ruleId: "zone/yellow-path", ruleIndex: index, level: "warning", message: { text: `${yellow.path} (in green ${yellow.module}): ${yellow.reason}` }, locations: location(yellow.path) });
  }
  for (const red of report.zones.redPaths) {
    const index = ruleIndex("zone/red-path", () => ZONE_RULES["red-path"]);
    const uri = red.kind === "directory" ? `${red.path}/` : red.path;
    results.push({ ruleId: "zone/red-path", ruleIndex: index, level: "note", message: { text: `${uri} is red (${red.term}): agents may only propose changes` }, locations: location(uri) });
  }

  const sarif = {
    $schema: SARIF_SCHEMA,
    version: "2.1.0",
    runs: [{
      tool: { driver: { name: report.tool.name, version: report.tool.version, informationUri: INFORMATION_URI, rules } },
      results,
      properties: {
        verdict: report.verdict.verdict,
        provisional: report.verdict.provisional,
        readiness: report.readiness.level,
        auditDate: report.auditDate,
        commit: report.target.head,
      },
    }],
  };
  return `${JSON.stringify(sarif, null, 2)}\n`;
}
