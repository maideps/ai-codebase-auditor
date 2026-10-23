import { describe, expect, it } from "vitest";
import { groupModules, moduleContaining } from "./modules.js";

const settings = { splitShare: 0.5, maxDepth: 3 };

describe("groupModules", () => {
  it("groups files by top-level directory, with root files in (root)", () => {
    const modules = groupModules(["app/a.rb", "lib/b.rb", "setup.py"], settings);
    expect([...modules.keys()].sort()).toEqual(["(root)", "app", "lib"]);
  });

  it("splits a directory holding more than the share into its subdirectories and own files, down to the depth limit", () => {
    const paths = ["src/a/x/1.c", "src/a/x/2.c", "src/a/y/3.c", "src/a/4.c", "src/b/5.c", "tools/6.c"];
    expect(Object.fromEntries(groupModules(paths, settings))).toEqual({
      "src/a/x": ["src/a/x/1.c", "src/a/x/2.c"],
      "src/a/y": ["src/a/y/3.c"],
      "src/a/(files)": ["src/a/4.c"],
      "src/b": ["src/b/5.c"],
      tools: ["tools/6.c"],
    });
  });

  it("does not split a directory without subdirectories", () => {
    expect([...groupModules(["lib/a.py", "lib/b.py", "x.py"], settings).keys()]).toEqual(["lib", "(root)"]);
  });
});

describe("moduleContaining", () => {
  const modules = ["app", "src/a/(files)", "src/a/x", "(root)"];

  it.each([
    ["app/models/user.rb", "app"],
    ["src/a/x/deep/file.c", "src/a/x"],
    ["src/a/helper.c", "src/a/(files)"],
    ["setup.py", "(root)"],
    ["gone/old.rb", null],
    ["src/a/z/new.c", null],
  ])("%s → %s", (path, expected) => {
    expect(moduleContaining(path, modules)).toBe(expected);
  });
});
