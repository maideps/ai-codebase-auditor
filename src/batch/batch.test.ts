import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { AuditReport } from "../report/model.js";
import { auditedEntry, buildPortfolio, formatPortfolio, parseRepoList, renderPortfolioJson, renderPortfolioMarkdown, type PortfolioEntry } from "./batch.js";

const report = JSON.parse(readFileSync(new URL("../report/__snapshots__/sample-report.json", import.meta.url), "utf8")) as AuditReport;
const base = path.resolve("/lists");

describe("parseRepoList", () => {
  it("reads one path per line, skipping blanks and comments, resolved against the list's directory", () => {
    const listed = parseRepoList("# legacy apps\n../repos/billing-app\n\n  /abs/crm  \r\n# done\n", base);
    expect(listed).toEqual([
      { line: 2, path: path.resolve(base, "../repos/billing-app"), folder: "billing-app" },
      { line: 4, path: path.resolve("/abs/crm"), folder: "crm" },
    ]);
  });

  it("gives repositories with the same directory name distinct folders, case-insensitively", () => {
    expect(parseRepoList("a/app\nb/app\nc/App\n", base).map((r) => r.folder)).toEqual(["app", "app-2", "App-3"]);
  });

  it("returns nothing for a list with no paths", () => {
    expect(parseRepoList("# nothing yet\n\n", base)).toEqual([]);
  });
});

describe("buildPortfolio", () => {
  const listed = { line: 1, path: "/repos/sample", folder: "sample" };
  const audited = auditedEntry(listed, report, 2);
  const adopt: PortfolioEntry = { ...audited, folder: "b-adopt", verdict: "adopt", weakFactors: [] } as PortfolioEntry;
  const prepare: PortfolioEntry = { ...audited, folder: "z-prepare", verdict: "prepare-first" } as PortfolioEntry;
  const none: PortfolioEntry = { ...audited, folder: "a-none", verdict: null } as PortfolioEntry;
  const failed: PortfolioEntry = { status: "failed", folder: "a-broken", path: "/repos/broken", error: "target /repos/broken is not a git repository" };

  it("summarizes a report: verdict, readiness, weak factors and path counts", () => {
    expect(audited).toEqual({
      status: "audited", folder: "sample", path: "/repos/sample", verdict: report.verdict.verdict, provisional: report.verdict.provisional,
      readiness: report.readiness.level, weakFactors: report.factors.filter((f) => f.score !== null && f.score <= 2).map((f) => `${f.id} ${f.score}`),
      redPaths: 1, yellowPaths: 1,
    });
  });

  it("sorts worst verdict first, failures last, and counts each verdict", () => {
    const portfolio = buildPortfolio([failed, adopt, none, prepare, audited], "2026-11-18");
    expect(portfolio.repositories.map((e) => e.folder)).toEqual(["z-prepare", "sample", "b-adopt", "a-none", "a-broken"]);
    expect(portfolio.counts).toEqual({ "prepare-first": 1, adapt: 1, adopt: 1, "no verdict": 1, failed: 1 });
  });

  it("renders text, Markdown and JSON, including the failure's reason", () => {
    const portfolio = buildPortfolio([failed, audited], "2026-11-18");
    expect(formatPortfolio(portfolio)).toContain("  failed         a-broken: target /repos/broken is not a git repository\n");
    expect(renderPortfolioMarkdown(portfolio)).toContain("| failed | `/repos/broken` | | target /repos/broken is not a git repository | | | |");
    expect(renderPortfolioMarkdown(portfolio)).toContain("| adapt | `/repos/sample` | ");
    expect(JSON.parse(renderPortfolioJson(portfolio))).toEqual(portfolio);
  });
});
