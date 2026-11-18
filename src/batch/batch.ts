// A portfolio audit: many repositories from a list file, each audited into its own
// folder, then one summary. One repository's failure is recorded and never stops
// the rest. Pure: the CLI reads the list, audits and writes.

import path from "node:path";
import type { AuditReport } from "../report/model.js";

export const PORTFOLIO_SCHEMA = "ai-codebase-auditor/portfolio";
export const PORTFOLIO_SCHEMA_VERSION = 1;
export const PORTFOLIO_FILES = { markdown: "ai-readiness-portfolio.md", json: "ai-readiness-portfolio.json" } as const;

export interface ListedRepository {
  /** 1-based line in the list file. */
  line: number;
  /** Absolute path, resolved against the list file's directory. */
  path: string;
  /** The folder its reports go to, under --out: the directory name, made unique. */
  folder: string;
}

/** One repository path per line; blank lines and lines starting with # are skipped. */
export function parseRepoList(text: string, baseDir: string): ListedRepository[] {
  const used = new Map<string, number>();
  const listed: ListedRepository[] = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    const entry = raw.trim();
    if (entry === "" || entry.startsWith("#")) return;
    const absolute = path.resolve(baseDir, entry);
    const base = path.basename(absolute).replace(/[^A-Za-z0-9._-]/g, "_") || "repository";
    const seen = (used.get(base.toLowerCase()) ?? 0) + 1;
    used.set(base.toLowerCase(), seen);
    listed.push({ line: index + 1, path: absolute, folder: seen === 1 ? base : `${base}-${seen}` });
  });
  return listed;
}

export type PortfolioEntry =
  | {
    status: "audited";
    folder: string;
    path: string;
    verdict: string | null;
    provisional: boolean;
    readiness: number | null;
    weakFactors: string[];
    redPaths: number;
    yellowPaths: number;
  }
  | { status: "failed"; folder: string; path: string; error: string };

export function auditedEntry(listed: ListedRepository, report: AuditReport, weakMax: number): PortfolioEntry {
  return {
    status: "audited",
    folder: listed.folder,
    path: listed.path,
    verdict: report.verdict.verdict,
    provisional: report.verdict.provisional,
    readiness: report.readiness.level,
    weakFactors: report.factors.filter((f) => f.score !== null && f.score <= weakMax).map((f) => `${f.id} ${f.score}`),
    redPaths: report.zones.redPaths.length,
    yellowPaths: report.zones.yellowPaths.length,
  };
}

export interface Portfolio {
  schema: typeof PORTFOLIO_SCHEMA;
  schemaVersion: typeof PORTFOLIO_SCHEMA_VERSION;
  auditDate: string;
  counts: { "prepare-first": number; adapt: number; adopt: number; "no verdict": number; failed: number };
  /** Worst verdict first (prepare first, adapt, adopt, no verdict), failures last; then by folder. */
  repositories: PortfolioEntry[];
}

const ORDER: Record<string, number> = { "prepare-first": 0, adapt: 1, adopt: 2 };
const rank = (entry: PortfolioEntry) => (entry.status === "failed" ? 4 : entry.verdict === null ? 3 : (ORDER[entry.verdict] ?? 3));

export function buildPortfolio(entries: readonly PortfolioEntry[], auditDate: string): Portfolio {
  const repositories = [...entries].sort((a, b) => rank(a) - rank(b) || (a.folder < b.folder ? -1 : a.folder > b.folder ? 1 : 0));
  const count = (test: (e: PortfolioEntry) => boolean) => entries.filter(test).length;
  const verdictIs = (v: string | null) => (e: PortfolioEntry) => e.status === "audited" && e.verdict === v;
  return {
    schema: PORTFOLIO_SCHEMA,
    schemaVersion: PORTFOLIO_SCHEMA_VERSION,
    auditDate,
    counts: {
      "prepare-first": count(verdictIs("prepare-first")),
      adapt: count(verdictIs("adapt")),
      adopt: count(verdictIs("adopt")),
      "no verdict": count(verdictIs(null)),
      failed: count((e) => e.status === "failed"),
    },
    repositories,
  };
}

const cell = (text: string) => text.replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ");
const countsLine = (p: Portfolio) => `prepare first ${p.counts["prepare-first"]}, adapt ${p.counts.adapt}, adopt ${p.counts.adopt}, no verdict ${p.counts["no verdict"]}, failed ${p.counts.failed}`;

export function formatPortfolio(p: Portfolio): string {
  const lines = [`Portfolio (${p.repositories.length} repositories, audited ${p.auditDate}): ${countsLine(p)}`];
  for (const e of p.repositories) {
    lines.push(e.status === "failed"
      ? `  failed         ${e.folder}: ${e.error}`
      : `  ${(e.verdict ?? "no verdict").padEnd(14)} ${e.folder}: readiness ${e.readiness ?? "none"}${e.provisional ? " (provisional)" : ""}, weak ${e.weakFactors.length > 0 ? e.weakFactors.join(", ") : "none"}, ${e.redPaths} red and ${e.yellowPaths} yellow paths`);
  }
  return `${lines.join("\n")}\n`;
}

export function renderPortfolioMarkdown(p: Portfolio): string {
  const lines = [
    "# AI-readiness portfolio",
    "",
    `Audited ${p.auditDate}. ${countsLine(p)}. Each repository's reports are in its folder.`,
    "",
    "| Verdict | Repository | Readiness | Weak factors | Red paths | Yellow paths | Folder |",
    "|---|---|---|---|---|---|---|",
    ...p.repositories.map((e) => e.status === "failed"
      ? `| failed | \`${cell(e.path)}\` | | ${cell(e.error)} | | | |`
      : `| ${e.verdict ?? "no verdict"}${e.provisional ? " (provisional)" : ""} | \`${cell(e.path)}\` | ${e.readiness ?? "none"} | ${e.weakFactors.length > 0 ? e.weakFactors.join(", ") : "none"} | ${e.redPaths} | ${e.yellowPaths} | \`${e.folder}/\` |`),
  ];
  return `${lines.join("\n")}\n`;
}

export function renderPortfolioJson(p: Portfolio): string {
  return `${JSON.stringify(p, null, 2)}\n`;
}
