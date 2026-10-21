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

export function isLockFile(filePath: string): boolean {
  return LOCK_FILE_NAMES.has(filePath.slice(filePath.lastIndexOf("/") + 1));
}
