// File classification shared by collectors and scoring: which extensions are
// source code, in which language family, how strongly typed, and which file
// names are lock files. Pure data; nothing here touches the file system.

export type Typing = "strong" | "weak" | "dynamic";

export interface Language {
  family: string;
  typing: Typing;
}

const strong = (family: string): Language => ({ family, typing: "strong" });
const weak = (family: string): Language => ({ family, typing: "weak" });
const dynamic = (family: string): Language => ({ family, typing: "dynamic" });

/** Source-code extensions; data, markup and docs are deliberately absent. */
export const LANGUAGE_BY_EXTENSION: Readonly<Record<string, Language>> = {
  ts: strong("typescript"), tsx: strong("typescript"),
  java: strong("java"), kt: strong("kotlin"), kts: strong("kotlin"), scala: strong("scala"),
  go: strong("go"), rs: strong("rust"), cs: strong("csharp"), fs: strong("fsharp"), vb: strong("vb"),
  swift: strong("swift"), dart: strong("dart"),
  c: weak("c"), h: weak("c"), cc: weak("cpp"), cpp: weak("cpp"), cxx: weak("cpp"), hpp: weak("cpp"),
  m: weak("objc"), mm: weak("objc"),
  js: dynamic("javascript"), jsx: dynamic("javascript"), mjs: dynamic("javascript"), cjs: dynamic("javascript"),
  py: dynamic("python"), rb: dynamic("ruby"), php: dynamic("php"), pl: dynamic("perl"), t: dynamic("perl"),
  lua: dynamic("lua"), sh: dynamic("shell"), bats: dynamic("shell"), ex: dynamic("elixir"), exs: dynamic("elixir"),
  erl: dynamic("erlang"), clj: dynamic("clojure"), groovy: dynamic("groovy"), r: dynamic("r"), jl: dynamic("julia"),
};

export const SOURCE_EXTENSIONS: ReadonlySet<string> = new Set(Object.keys(LANGUAGE_BY_EXTENSION));

/** Language families with dynamic-call detection rules; TypeScript uses the JavaScript rules. */
export type DynamicFamily = "python" | "php" | "ruby" | "java" | "javascript";

export const DYNAMIC_CALL_FAMILIES: Readonly<Record<string, DynamicFamily>> = {
  python: "python", php: "php", ruby: "ruby", java: "java", javascript: "javascript", typescript: "javascript",
};

export const LOCK_FILE_NAMES: ReadonlySet<string> = new Set([
  "package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "pnpm-lock.yaml", "composer.lock",
  "Gemfile.lock", "poetry.lock", "Pipfile.lock", "Cargo.lock", "go.sum",
]);

/** Lower-case extension of a file name or path, without the dot; "" when none. */
export function extensionOf(filePath: string): string {
  const name = filePath.slice(filePath.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export function languageOf(filePath: string): Language | null {
  return LANGUAGE_BY_EXTENSION[extensionOf(filePath)] ?? null;
}

const TEST_PATH_SEGMENTS: ReadonlySet<string> = new Set([
  "test", "tests", "spec", "specs", "__tests__", "fixtures", "__fixtures__", "testdata", "test-fixtures",
]);

/**
 * True when a directory on the path holds tests or test data, or is a
 * source-set resources folder (src/<set>/resources). Files there describe
 * test inputs, not the product.
 */
export function isUnderTestPath(filePath: string): boolean {
  const directories = filePath.split("/").slice(0, -1);
  return directories.some(
    (segment, index) => TEST_PATH_SEGMENTS.has(segment) || (segment === "resources" && directories[index - 2] === "src"),
  );
}

export function isLockFile(filePath: string): boolean {
  return LOCK_FILE_NAMES.has(filePath.slice(filePath.lastIndexOf("/") + 1));
}
