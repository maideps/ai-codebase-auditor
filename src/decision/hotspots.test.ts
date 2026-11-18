import { describe, expect, it } from "vitest";
import { findHotspots, nameWords, testsNamedAfter, type HotspotCandidate, type HotspotSettings } from "./hotspots.js";

const settings: HotspotSettings = { percentile: 0.9, minCommits: 4, minLines: 300 };

const file = (path: string, commitsLastYear: number, lines: number): HotspotCandidate => ({ path, commitsLastYear, lines, complexity: null });

describe("nameWords", () => {
  it.each([
    ["src/notification_method_webpush_test.php", ["notification", "method", "webpush", "test"]],
    ["core/src/test/java/StrutsConstantsTest.java", ["struts", "constants", "test"]],
    ["web/src/user-profile.spec.ts", ["user", "profile", "spec"]],
    ["lib/oauth2_client.py", ["oauth2", "client"]],
    ["app/XMLParser.rb", ["xmlparser"]],
  ])("%s → %j", (path, words) => {
    expect(nameWords(path)).toEqual(words);
  });
});

describe("testsNamedAfter", () => {
  it.each([
    ["phpBB/phpbb/notification/method/webpush.php", "tests/notification/notification_method_webpush_test.php"],
    ["core/src/main/java/org/x/StrutsConstants.java", "core/src/test/java/org/x/StrutsConstantsTest.java"],
    ["MoinMoin/action/info.py", "MoinMoin/action/_tests/test_info.py"],
    ["app/models/issue.rb", "test/unit/issue_test.rb"],
    ["src/user-profile.ts", "src/user-profile.spec.ts"],
    ["src/Widget.ts", "src/__tests__/WidgetTests.ts"],
  ])("%s is named by %s", (source, test) => {
    expect(testsNamedAfter(source, [test])).toEqual([test]);
  });

  it.each([
    ["lib/db.php", "tests/dbal_test.php", "a partial word"],
    ["app/models/issue.rb", "test/unit/issue_status_test.rb", "a test named after a longer name"],
    ["lib/redmine/preparation.rb", "test/unit/lib/redmine/plugin_test.rb", "another name"],
  ])("%s is not named by %s (%s)", (source, test) => {
    expect(testsNamedAfter(source, [test])).toEqual([]);
  });

  it("lists every test named after the file, sorted", () => {
    const tests = ["test/z/issue_test.rb", "test/a/issue_test.rb", "test/unit/project_test.rb"];
    expect(testsNamedAfter("app/models/issue.rb", tests)).toEqual(["test/a/issue_test.rb", "test/z/issue_test.rb"]);
  });
});

describe("findHotspots", () => {
  it("takes files at or above the module's 90th percentile of recent commits and of length", () => {
    // Commits 1..10 and lines 100..1000: p90 is the 9th value, 9 commits and 900 lines.
    const files = Array.from({ length: 10 }, (_, i) => file(`src/f${i + 1}.ts`, i + 1, (i + 1) * 100));
    const result = findHotspots(files, [], settings);
    expect(result.commitCut).toBe(9);
    expect(result.lineCut).toBe(900);
    expect(result.hotspots.map((h) => h.path)).toEqual(["src/f10.ts", "src/f9.ts"]);
  });

  it("needs both: a long file that rarely changes and a busy short file are not hotspots", () => {
    const files = [...Array.from({ length: 8 }, (_, i) => file(`src/q${i}.ts`, 1, 50)), file("src/long.ts", 1, 2000), file("src/busy.ts", 30, 60)];
    expect(findHotspots(files, [], settings).hotspots).toEqual([]);
  });

  it("applies the floors: exactly 4 commits and 300 lines count, 3 commits or 299 lines do not", () => {
    expect(findHotspots([file("a.ts", 4, 300)], [], settings).hotspots.map((h) => h.path)).toEqual(["a.ts"]);
    expect(findHotspots([file("a.ts", 3, 300)], [], settings).hotspots).toEqual([]);
    expect(findHotspots([file("a.ts", 4, 299)], [], settings).hotspots).toEqual([]);
  });

  it("takes the commit percentile among files changed in the window only", () => {
    const quiet = Array.from({ length: 20 }, (_, i) => file(`src/q${i}.ts`, 0, 400));
    const result = findHotspots([...quiet, file("src/a.ts", 5, 400), file("src/b.ts", 6, 400)], [], settings);
    expect(result.commitCut).toBe(6);
    expect(result.hotspots.map((h) => h.path)).toEqual(["src/b.ts"]);
  });

  it("includes every file tied at the cut", () => {
    const files = [...Array.from({ length: 8 }, (_, i) => file(`src/q${i}.ts`, 1, 100)), file("src/x.ts", 7, 500), file("src/y.ts", 7, 500)];
    expect(findHotspots(files, [], settings).hotspots.map((h) => h.path)).toEqual(["src/x.ts", "src/y.ts"]);
  });

  it("finds none when no file changed in the window", () => {
    const result = findHotspots([file("src/a.ts", 0, 5000)], [], settings);
    expect(result).toEqual({ hotspots: [], commitCut: null, lineCut: 5000 });
  });

  it("records the tests named after each hotspot, most commits first", () => {
    const files = [file("src/a.ts", 5, 400), file("src/b.ts", 9, 400)];
    const result = findHotspots(files, ["test/a.test.ts"], { ...settings, percentile: 0.1 });
    expect(result.hotspots).toEqual([
      { path: "src/b.ts", commitsLastYear: 9, lines: 400, complexity: null, testedBy: [] },
      { path: "src/a.ts", commitsLastYear: 5, lines: 400, complexity: null, testedBy: ["test/a.test.ts"] },
    ]);
  });
});
