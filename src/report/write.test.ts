import { mkdirSync, mkdtempSync, readFileSync, symlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkOutDir, REPORT_FILES, writeReports } from "./write.js";

const scratch = mkdtempSync(path.join(os.tmpdir(), "aca-report-"));
const target = path.join(scratch, "target");
mkdirSync(path.join(target, "src"), { recursive: true });

describe("checkOutDir", () => {
  it("accepts a directory outside the target, existing or not", () => {
    expect(checkOutDir(path.join(scratch, "reports"), target)).toEqual([]);
    expect(checkOutDir(path.join(scratch, "new", "deeper"), target)).toEqual([]);
  });

  it("rejects the target itself and anything inside it", () => {
    expect(checkOutDir(target, target)).toEqual([`out directory ${target} is inside the audited repository ${target}`]);
    const inside = path.join(target, "src", "reports");
    expect(checkOutDir(inside, target)).toEqual([`out directory ${inside} is inside the audited repository ${target}`]);
  });

  it("rejects a link that leads into the target", () => {
    const link = path.join(scratch, "link-to-target");
    symlinkSync(target, link, process.platform === "win32" ? "junction" : "dir");
    const viaLink = path.join(link, "reports");
    expect(checkOutDir(viaLink, target)).toEqual([`out directory ${viaLink} is inside the audited repository ${target}`]);
  });

  it("does not confuse a sibling whose name starts with the target's", () => {
    expect(checkOutDir(path.join(scratch, "target-reports"), target)).toEqual([]);
  });
});

describe("writeReports", () => {
  it("creates the directory and writes both files with the given content", () => {
    const out = path.join(scratch, "out", "nested");
    const written = writeReports(out, { markdown: "# r\n", json: "{}\n" });
    expect(written).toEqual({ markdown: path.join(out, REPORT_FILES.markdown), json: path.join(out, REPORT_FILES.json) });
    expect(readFileSync(written.markdown, "utf8")).toBe("# r\n");
    expect(readFileSync(written.json, "utf8")).toBe("{}\n");
  });

  it("overwrites an earlier report of the same name", () => {
    const out = path.join(scratch, "again");
    writeReports(out, { markdown: "old\n", json: "{}\n" });
    writeReports(out, { markdown: "new\n", json: "{}\n" });
    expect(readFileSync(path.join(out, REPORT_FILES.markdown), "utf8")).toBe("new\n");
  });
});
