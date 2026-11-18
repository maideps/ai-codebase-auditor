// Ready-to-use harness files from the plan, zones and roadmap, written under
// --out/harness/ for a person to copy into the audited repository. Nothing is
// ever written there by the tool. Pure: the same inputs give the same bytes.

import type { VerdictKind, Zones } from "../decision/types.js";
import type { Plan, PlanItem } from "./plan.js";
import type { RoadmapStep } from "./roadmap.js";

export const HARNESS_DIR = "harness";

export interface HarnessFilesInput {
  tool: { name: string; version: string };
  auditDate: string;
  commit: string | null;
  verdict: VerdictKind | null;
  plan: Plan;
  zones: Zones;
  roadmap: readonly RoadmapStep[];
}

export interface GeneratedFile {
  /** Relative to the --out directory, with forward slashes. */
  path: string;
  content: string;
}

const pattern = (path: string, kind: "directory" | "file") => (kind === "directory" ? `${path}/**` : path);
const triggerText = (item: PlanItem) =>
  item.trigger.kind === "factor"
    ? `${item.trigger.factor} scored ${item.trigger.score}`
    : `${item.trigger.zone} zone: ${item.trigger.count} ${item.id === "yellow-modules" ? "module" : "path"}${item.trigger.count === 1 ? "" : "s"}`;

function denyEntries(zones: Zones): { rule: string; path: string; term: string }[] {
  return zones.redPaths
    .flatMap((red) => ["Edit", "Write"].map((tool) => ({ rule: `${tool}(${pattern(red.path, red.kind)})`, path: `${red.path}${red.kind === "directory" ? "/" : ""}`, term: red.term })))
    .sort((a, b) => (a.rule < b.rule ? -1 : a.rule > b.rule ? 1 : 0));
}

function agentsSnippet(input: HarnessFilesInput, origin: string): string {
  const lines = [
    "## Agent rules from the AI-readiness audit",
    "",
    `<!-- ${origin}. Each rule cites the plan item and the score or zone behind it. -->`,
    "",
  ];
  if (input.plan.items.length === 0) return `${[...lines, "No adaptations: the plan has no items."].join("\n")}\n`;
  for (const item of input.plan.items) {
    lines.push(`### ${item.id} (${item.level}; ${triggerText(item)})`, "", item.change, "", `Why: ${item.why}`);
    if (item.details.length > 0) lines.push("", ...item.details.map((detail) => `- ${detail}`));
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

function checklist(input: HarnessFilesInput, origin: string): string {
  const yellowModules = input.zones.modules.filter((m) => m.zone === "yellow");
  const lines = [
    "# Characterization tests before agents edit",
    "",
    `${origin}. Pin current behavior, quirks included, and make the tests pass against the unchanged code before any feature work. The agent that changes the code should not be the only author of these tests.`,
    "",
  ];
  if (yellowModules.length === 0 && input.zones.yellowPaths.length === 0) return `${[...lines, "Nothing to do: no yellow modules or yellow paths."].join("\n")}\n`;
  if (yellowModules.length > 0) {
    lines.push("## Yellow modules (zone: yellow)", "", ...yellowModules.map((m) => `- [ ] \`${m.module}\` (${m.sourceFiles} source files): ${m.reason}`), "");
  }
  if (input.zones.yellowPaths.length > 0) {
    lines.push("## Yellow paths in green modules (zone: yellow path, D-019)", "", ...input.zones.yellowPaths.map((y) => `- [ ] \`${y.path}\` (in \`${y.module}\`): ${y.reason}`), "");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

function roadmapChecks(input: HarnessFilesInput, origin: string): string {
  return `${JSON.stringify({
    origin,
    howToCheck: "Re-run `ai-codebase-auditor audit <repo> --out <dir>` after the step and read factors[].score for the factor in ai-readiness-report.json: it should be at least minScore.",
    checks: input.roadmap.map((step, index) => ({
      order: index + 1,
      factor: step.factor,
      from: step.from,
      minScore: step.to,
      effort: step.effort,
      action: step.action,
      verdictAfter: step.verdictAfter,
    })),
  }, null, 2)}\n`;
}

function readme(input: HarnessFilesInput, origin: string, deny: ReturnType<typeof denyEntries>): string {
  const lines = [
    "# Generated harness files",
    "",
    `${origin}. Verdict: ${input.verdict ?? "none"}. For ${input.plan.harness.name} ${input.plan.harness.version}. Nothing here has been applied: copy what fits into the audited repository and review it there.`,
    "",
    "| File | Use | Generated from |",
    "|---|---|---|",
    `| \`AGENTS.snippet.md\` | append to the repository's \`AGENTS.md\` | the plan's ${input.plan.items.length} item${input.plan.items.length === 1 ? "" : "s"} |`,
    `| \`claude-settings.json\` | merge into \`.claude/settings.json\` | the ${input.zones.redPaths.length} red path${input.zones.redPaths.length === 1 ? "" : "s"} |`,
    `| \`characterization-tests.md\` | a checklist before agents edit | ${input.zones.modules.filter((m) => m.zone === "yellow").length} yellow modules and ${input.zones.yellowPaths.length} yellow paths |`,
    `| \`roadmap-checks.json\` | what a re-audit should show after each roadmap step | the roadmap's ${input.roadmap.length} step${input.roadmap.length === 1 ? "" : "s"} |`,
    "",
    "## Deny rules and the red paths behind them",
    "",
  ];
  if (deny.length === 0) lines.push("None: the audit found no red paths.");
  else lines.push("| Rule | Red path | Term |", "|---|---|---|", ...deny.map((d) => `| \`${d.rule}\` | \`${d.path}\` | ${d.term} |`));
  return `${lines.join("\n")}\n`;
}

/** The files to write under <out>/harness/, sorted by path. */
export function buildHarnessFiles(input: HarnessFilesInput): GeneratedFile[] {
  const origin = `Generated by ${input.tool.name} ${input.tool.version} from the audit of ${input.auditDate}${input.commit ? `, commit ${input.commit.slice(0, 12)}` : ""}`;
  const deny = denyEntries(input.zones);
  const settings = `${JSON.stringify({ permissions: { deny: deny.map((d) => d.rule) } }, null, 2)}\n`;
  return [
    { path: `${HARNESS_DIR}/AGENTS.snippet.md`, content: agentsSnippet(input, origin) },
    { path: `${HARNESS_DIR}/README.md`, content: readme(input, origin, deny) },
    { path: `${HARNESS_DIR}/characterization-tests.md`, content: checklist(input, origin) },
    { path: `${HARNESS_DIR}/claude-settings.json`, content: settings },
    { path: `${HARNESS_DIR}/roadmap-checks.json`, content: roadmapChecks(input, origin) },
  ];
}
