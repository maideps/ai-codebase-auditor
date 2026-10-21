// Static parsers for dependency manifests and runtime version files. They
// read text only: setup.py is never executed, Gradle and Maven files are
// never evaluated, and nothing is resolved or installed.

import type { Runtime } from "../../config/runtime-eol.js";
import { parseToml, TomlError, type TomlValue } from "./toml.js";

export type Ecosystem = "npm" | "pip" | "composer" | "bundler" | "maven" | "gradle" | "runtime-file";
export type DependencyScope = "runtime" | "development" | "optional" | "peer";

export interface Dependency {
  name: string;
  /** The version spec as written, or null when none is declared. */
  spec: string | null;
  scope: DependencyScope;
}

export interface RuntimeDeclaration {
  runtime: Runtime;
  spec: string;
  /** Where in the file the declaration sits, such as engines.node. */
  via: string;
}

export interface ParsedManifest {
  ecosystem: Ecosystem;
  /** Sorted by name. */
  dependencies: Dependency[];
  /** In file order. */
  runtimes: RuntimeDeclaration[];
  /** Parts of the file that were seen but not parsed. */
  issues: string[];
}

type ParseResult = ParsedManifest | { error: string };
type Parser = (text: string) => ParseResult;

const byName = (a: Dependency, b: Dependency) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.scope < b.scope ? -1 : 1);

function manifest(ecosystem: Ecosystem, dependencies: Dependency[], runtimes: RuntimeDeclaration[] = [], issues: string[] = []): ParsedManifest {
  return { ecosystem, dependencies: [...dependencies].sort(byName), runtimes, issues: [...new Set(issues)] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJson(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text);
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

function entries(value: unknown): [string, string][] {
  return isRecord(value) ? Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string") : [];
}

// ---- npm ----

const parsePackageJson: Parser = (text) => {
  const json = parseJson(text);
  if (!json) return { error: "invalid JSON" };
  const groups: [string, DependencyScope][] = [
    ["dependencies", "runtime"], ["devDependencies", "development"], ["optionalDependencies", "optional"], ["peerDependencies", "peer"],
  ];
  const dependencies = groups.flatMap(([key, scope]) => entries(json[key]).map(([name, spec]) => ({ name, spec, scope })));
  const node = isRecord(json.engines) ? json.engines.node : undefined;
  return manifest("npm", dependencies, typeof node === "string" ? [{ runtime: "node", spec: node, via: "engines.node" }] : []);
};

// ---- Python ----

const REQUIREMENT = /^([A-Za-z0-9][A-Za-z0-9._-]*)\s*(?:\[[^\]]*\])?\s*([^;]*?)\s*(?:;.*)?$/;

function parseRequirement(text: string, scope: DependencyScope): Dependency | null {
  const match = REQUIREMENT.exec(text.trim());
  if (!match) return null;
  const spec = (match[2] ?? "").replace(/^\((.*)\)$/, "$1").trim();
  return { name: match[1] ?? "", spec: spec === "" ? null : spec, scope };
}

const parseRequirementsTxt: Parser = (text) => {
  const dependencies: Dependency[] = [];
  const issues: string[] = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.replace(/(^|\s)#.*$/, "").trim();
    if (line === "") return;
    if (/^(?:-e|--editable)\b/.test(line)) issues.push(`line ${index + 1}: editable or URL requirement not parsed`);
    else if (line.startsWith("-")) return; // -r, -c, --index-url and other options
    else if (line.includes("://") || /^[./]/.test(line)) issues.push(`line ${index + 1}: editable or URL requirement not parsed`);
    else {
      const dependency = parseRequirement(line, "runtime");
      if (dependency) dependencies.push(dependency);
      else issues.push(`line ${index + 1}: not a requirement`);
    }
  });
  return manifest("pip", dependencies, [], issues);
};

// The text between a "[" at start and its matching "]", ignoring brackets in strings.
function bracketed(text: string, start: number): string | null {
  let quote: string | null = null;
  for (let i = start + 1; i < text.length; i += 1) {
    const char = text[i];
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === "'" || char === '"') quote = char;
    else if (char === "]") return text.slice(start + 1, i);
  }
  return null;
}

const STRING_LITERAL = /(['"])((?:(?!\1).)*)\1/g;

const parseSetupPy: Parser = (text) => {
  const runtimes: RuntimeDeclaration[] = [];
  const dependencies: Dependency[] = [];
  const issues: string[] = [];
  const pythonRequires = /python_requires\s*=\s*(['"])(.*?)\1/.exec(text);
  if (pythonRequires?.[2]) runtimes.push({ runtime: "python", spec: pythonRequires[2], via: "python_requires" });
  for (const match of text.matchAll(/Programming Language :: Python :: (\d+\.\d+)\b/g)) {
    if (match[1] && !runtimes.some((r) => r.via === "classifier" && r.spec === match[1])) runtimes.push({ runtime: "python", spec: match[1], via: "classifier" });
  }
  const install = /install_requires\s*=\s*/.exec(text);
  if (install) {
    const start = install.index + install[0].length;
    const list = text[start] === "[" ? bracketed(text, start) : null;
    if (list === null) issues.push("install_requires is not a literal list; not parsed");
    else {
      for (const literal of list.matchAll(STRING_LITERAL)) {
        const dependency = parseRequirement(literal[2] ?? "", "runtime");
        if (dependency) dependencies.push(dependency);
      }
    }
  }
  return manifest("pip", dependencies, runtimes, issues);
};

function poetrySpec(value: TomlValue): string | null {
  if (typeof value === "string") return value;
  if (isRecord(value) && typeof value.version === "string") return value.version;
  return null;
}

const parsePyproject: Parser = (text) => {
  let tables;
  try {
    tables = parseToml(text);
  } catch (error) {
    if (error instanceof TomlError) return { error: `invalid TOML (${error.message})` };
    throw error;
  }
  const dependencies: Dependency[] = [];
  const runtimes: RuntimeDeclaration[] = [];
  const project = tables.project ?? {};
  if (typeof project["requires-python"] === "string") runtimes.push({ runtime: "python", spec: project["requires-python"], via: "requires-python" });
  const strings = (value: TomlValue | undefined) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
  for (const requirement of strings(project.dependencies)) {
    const dependency = parseRequirement(requirement, "runtime");
    if (dependency) dependencies.push(dependency);
  }
  for (const group of Object.values(tables["project.optional-dependencies"] ?? {})) {
    for (const requirement of strings(group)) {
      const dependency = parseRequirement(requirement, "optional");
      if (dependency) dependencies.push(dependency);
    }
  }
  for (const [tableName, table] of Object.entries(tables)) {
    const runtimeTable = tableName === "tool.poetry.dependencies";
    const devTable = tableName === "tool.poetry.dev-dependencies" || /^tool\.poetry\.group\.[^.]+\.dependencies$/.test(tableName);
    if (!runtimeTable && !devTable) continue;
    for (const [name, value] of Object.entries(table)) {
      if (runtimeTable && name === "python") {
        const spec = poetrySpec(value);
        if (spec) runtimes.push({ runtime: "python", spec, via: "tool.poetry.dependencies.python" });
      } else {
        dependencies.push({ name, spec: poetrySpec(value), scope: devTable ? "development" : "runtime" });
      }
    }
  }
  return manifest("pip", dependencies, runtimes);
};

// ---- PHP ----

const parseComposerJson: Parser = (text) => {
  const json = parseJson(text);
  if (!json) return { error: "invalid JSON" };
  const dependencies: Dependency[] = [];
  const runtimes: RuntimeDeclaration[] = [];
  for (const [key, scope] of [["require", "runtime"], ["require-dev", "development"]] as const) {
    for (const [name, spec] of entries(json[key])) {
      if (name === "php") {
        if (key === "require") runtimes.push({ runtime: "php", spec, via: "require.php" });
      } else if (name.includes("/")) {
        dependencies.push({ name, spec, scope }); // platform packages (ext-*, lib-*) have no vendor prefix
      }
    }
  }
  const platform = isRecord(json.config) && isRecord(json.config.platform) ? json.config.platform.php : undefined;
  if (typeof platform === "string") runtimes.push({ runtime: "php", spec: platform, via: "config.platform.php" });
  return manifest("composer", dependencies, runtimes);
};

// ---- Ruby ----

const isDevGroup = (text: string) => /:(?:development|test)\b|["'](?:development|test)["']/.test(text);

const parseGemfile: Parser = (text) => {
  const dependencies: Dependency[] = [];
  const runtimes: RuntimeDeclaration[] = [];
  const issues: string[] = [];
  const devStack: boolean[] = [];
  const inDev = () => devStack[devStack.length - 1] ?? false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, "").trim();
    if (line === "" || line.startsWith("#")) continue;
    const ruby = /^ruby\s+['"]([^'"]+)['"]/.exec(line);
    if (ruby?.[1]) {
      runtimes.push({ runtime: "ruby", spec: ruby[1], via: "ruby directive" });
      continue;
    }
    if (/^gemspec\b/.test(line)) {
      issues.push("dependencies declared in a gemspec are not parsed");
      continue;
    }
    const group = /^group\s+(.*?)\s+do\b/.exec(line);
    if (group) {
      devStack.push(inDev() || isDevGroup(group[1] ?? ""));
      continue;
    }
    if (/^end\b/.test(line)) {
      devStack.pop();
      continue;
    }
    const gem = /^gem\s+['"]([^'"]+)['"](.*)$/.exec(line);
    if (gem?.[1]) {
      const rest = gem[2] ?? "";
      const versions = [...rest.matchAll(STRING_LITERAL)].map((m) => m[2] ?? "").filter((value) => /^[~><=!\s]*\d/.test(value));
      const groupOption = /groups?:\s*(\[[^\]]*\]|:\w+)/.exec(rest);
      const dev = inDev() || (groupOption ? isDevGroup(groupOption[1] ?? "") : false);
      dependencies.push({ name: gem[1], spec: versions.length > 0 ? versions.join(", ") : null, scope: dev ? "development" : "runtime" });
    }
    if (/\bdo\s*(?:\|[^|]*\|)?$/.test(line)) devStack.push(inDev()); // platforms, source and other blocks
  }
  return manifest("bundler", dependencies, runtimes, issues);
};

// ---- JVM ----

const tag = (block: string, name: string) => new RegExp(`<${name}>\\s*([^<]*?)\\s*</${name}>`).exec(block)?.[1] ?? null;

const parsePomXml: Parser = (raw) => {
  const text = raw.replace(/<!--[\s\S]*?-->/g, "");
  const issues: string[] = [];
  const parent = /<parent>([\s\S]*?)<\/parent>/.exec(text);
  if (parent?.[1]) {
    issues.push(`inherits from a parent POM (${tag(parent[1], "groupId") ?? "?"}:${tag(parent[1], "artifactId") ?? "?"}); inherited dependencies and properties are not resolved`);
  }
  const properties = new Map<string, string>();
  const propertiesBlock = /<properties>([\s\S]*?)<\/properties>/.exec(text)?.[1] ?? "";
  for (const match of propertiesBlock.matchAll(/<([\w.-]+)>\s*([^<]*?)\s*<\/\1>/g)) {
    if (match[1]) properties.set(match[1], match[2] ?? "");
  }
  const resolve = (value: string | null): string | null => {
    if (value === null) return null;
    return value.replace(/\$\{([^}]+)\}/g, (whole, name: string) => {
      const found = properties.get(name);
      if (found === undefined) {
        issues.push(`unresolved property ${whole}`);
        return whole;
      }
      return found;
    });
  };
  const dependencies: Dependency[] = [];
  for (const match of text.matchAll(/<dependency>([\s\S]*?)<\/dependency>/g)) {
    const block = match[1] ?? "";
    const artifact = tag(block, "artifactId");
    if (!artifact) continue;
    const group = tag(block, "groupId");
    dependencies.push({
      name: group ? `${group}:${artifact}` : artifact,
      spec: resolve(tag(block, "version")),
      scope: tag(block, "scope") === "test" ? "development" : "runtime",
    });
  }
  const runtimes: RuntimeDeclaration[] = [];
  const javaProperty = ["maven.compiler.release", "maven.compiler.source", "java.version", "maven.compiler.target"].find((key) => properties.has(key));
  if (javaProperty) {
    runtimes.push({ runtime: "java", spec: resolve(properties.get(javaProperty) ?? "") ?? "", via: javaProperty });
  } else {
    const plugin = /<artifactId>maven-compiler-plugin<\/artifactId>([\s\S]*?)<\/plugin>/.exec(text)?.[1] ?? "";
    for (const name of ["release", "source"]) {
      const value = tag(plugin, name);
      if (value) {
        runtimes.push({ runtime: "java", spec: resolve(value) ?? value, via: `maven-compiler-plugin ${name}` });
        break;
      }
    }
  }
  return manifest("maven", dependencies, runtimes, issues);
};

const GRADLE_CONFIGURATIONS =
  "implementation|api|compile|compileOnly|runtimeOnly|runtime|testImplementation|testCompile|testCompileOnly|testRuntimeOnly|androidTestImplementation|annotationProcessor|kapt";

const parseGradle: Parser = (text) => {
  const dependencies: Dependency[] = [];
  const scopeOf = (configuration: string): DependencyScope => (/^(?:test|androidTest)/.test(configuration) ? "development" : "runtime");
  const stringNotation = new RegExp(`\\b(${GRADLE_CONFIGURATIONS})\\s*\\(?\\s*["']([^"':\\s]+):([^"':\\s]+)(?::([^"'\\s]+))?["']`, "g");
  for (const match of text.matchAll(stringNotation)) {
    dependencies.push({ name: `${match[2] ?? ""}:${match[3] ?? ""}`, spec: match[4] ?? null, scope: scopeOf(match[1] ?? "") });
  }
  const mapNotation = new RegExp(
    `\\b(${GRADLE_CONFIGURATIONS})\\s*\\(?\\s*group\\s*[:=]\\s*["']([^"']+)["']\\s*,\\s*name\\s*[:=]\\s*["']([^"']+)["'](?:\\s*,\\s*version\\s*[:=]\\s*["']([^"']+)["'])?`,
    "g",
  );
  for (const match of text.matchAll(mapNotation)) {
    dependencies.push({ name: `${match[2] ?? ""}:${match[3] ?? ""}`, spec: match[4] ?? null, scope: scopeOf(match[1] ?? "") });
  }
  const runtimes: RuntimeDeclaration[] = [];
  const toolchain = /JavaLanguageVersion\.of\(\s*(\d+)\s*\)/.exec(text);
  const compatibility = (key: string) => {
    const match = new RegExp(`${key}\\s*=\\s*(?:JavaVersion\\.VERSION_([\\d_]+)|["']?([\\d.]+)["']?)`).exec(text);
    return match ? (match[1]?.replace(/_/g, ".") ?? match[2] ?? null) : null;
  };
  const source = compatibility("sourceCompatibility");
  const target = compatibility("targetCompatibility");
  if (toolchain?.[1]) runtimes.push({ runtime: "java", spec: toolchain[1], via: "toolchain languageVersion" });
  else if (source) runtimes.push({ runtime: "java", spec: source, via: "sourceCompatibility" });
  else if (target) runtimes.push({ runtime: "java", spec: target, via: "targetCompatibility" });
  return manifest("gradle", dependencies, runtimes);
};

// ---- runtime version files ----

function firstLine(text: string): string | null {
  return text.split(/\r?\n/).map((line) => line.trim()).find((line) => line !== "" && !line.startsWith("#")) ?? null;
}

function versionFile(runtime: Runtime, via: string): Parser {
  return (text) => {
    const spec = firstLine(text);
    return manifest("runtime-file", [], spec ? [{ runtime, spec, via }] : []);
  };
}

const TOOL_VERSIONS: Record<string, Runtime> = { nodejs: "node", node: "node", python: "python", ruby: "ruby", php: "php", java: "java" };

const parseToolVersions: Parser = (text) => {
  const runtimes: RuntimeDeclaration[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const [tool, version] = raw.replace(/#.*$/, "").trim().split(/\s+/);
    const runtime = tool ? TOOL_VERSIONS[tool] : undefined;
    if (runtime && version) runtimes.push({ runtime, spec: version, via: ".tool-versions" });
  }
  return manifest("runtime-file", [], runtimes);
};

const parseRuntimeTxt: Parser = (text) => {
  const spec = firstLine(text);
  return manifest("runtime-file", [], spec?.startsWith("python-") ? [{ runtime: "python", spec, via: "runtime.txt" }] : []);
};

// ---- dispatch ----

function parserFor(filePath: string): Parser | null {
  const segments = filePath.split("/");
  const name = segments[segments.length - 1] ?? "";
  if (name === "package.json") return parsePackageJson;
  if (/^requirements.*\.txt$/.test(name) || (name.endsWith(".txt") && segments.slice(0, -1).includes("requirements"))) return parseRequirementsTxt;
  if (name === "setup.py") return parseSetupPy;
  if (name === "pyproject.toml") return parsePyproject;
  if (name === "composer.json") return parseComposerJson;
  if (name === "Gemfile") return parseGemfile;
  if (name === "pom.xml") return parsePomXml;
  if (name === "build.gradle" || name === "build.gradle.kts") return parseGradle;
  if (name === ".nvmrc") return versionFile("node", ".nvmrc");
  if (name === ".node-version") return versionFile("node", ".node-version");
  if (name === ".python-version") return versionFile("python", ".python-version");
  if (name === ".ruby-version") return versionFile("ruby", ".ruby-version");
  if (name === "runtime.txt") return parseRuntimeTxt;
  if (name === ".tool-versions") return parseToolVersions;
  return null;
}

/** True for manifests and runtime files this collector parses. */
export function isSupportedManifest(filePath: string): boolean {
  return parserFor(filePath) !== null;
}

/** Parses a supported manifest; null when the file is not one. */
export function parseManifest(filePath: string, text: string): ParseResult | null {
  const parser = parserFor(filePath);
  return parser ? parser(text) : null;
}

const UNSUPPORTED_NAMES = new Set([
  "go.mod", "Cargo.toml", "Pipfile", "environment.yml", "environment.yaml", "setup.cfg", "mix.exs", "build.sbt", "Package.swift",
  "pubspec.yaml", "conanfile.txt", "conanfile.py", "vcpkg.json", "bower.json", "project.clj", "deps.edn", "rebar.config",
  "Podfile", "Cartfile", "packages.config", "Directory.Packages.props",
]);
const UNSUPPORTED_EXTENSIONS = /\.(?:gemspec|csproj|fsproj|vbproj|nuspec)$/;

/** True for dependency manifests of ecosystems this collector does not parse. */
export function isUnsupportedManifest(filePath: string): boolean {
  const name = filePath.slice(filePath.lastIndexOf("/") + 1);
  return UNSUPPORTED_NAMES.has(name) || UNSUPPORTED_EXTENSIONS.test(name);
}
