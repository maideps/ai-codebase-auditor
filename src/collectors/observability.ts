// Observability collector: logging calls, console output and observability
// imports in the tracked source files, plus logging configuration files and
// framework log settings. Reads file content from the working tree, never
// through links, and never writes or runs anything.

import { realpathSync } from "node:fs";
import { DYNAMIC_CALL_FAMILIES, isUnderTestDirectory, languageOf, SOURCE_EXTENSIONS, extensionOf, type DynamicFamily } from "../file-kinds.js";
import { integrationOf, type IntegrationKind } from "../observability-names.js";
import { stripCode } from "./dynamic-calls/strip.js";
import { createGitRunner, GitError, hasCommits } from "./git.js";
import { isGenerated, isVendored, listTree, readTrackedFile, type ReadSkip, type TreeEntry } from "./tree.js";
import type { Evidence, Measurement } from "./types.js";

export interface ObservabilityFile {
  path: string;
  /** Logging calls by form, sorted by form. */
  logging: { form: string; calls: number }[];
  /** console.log and its siblings: debugging output, not logging. */
  console: number;
  /** Observability libraries named on import lines. */
  integrations: { name: string; kind: IntegrationKind; line: number }[];
}

export type LoggingConfigKind = "configuration file" | "Rails log setting" | "Django LOGGING" | "Python logging config";

export interface Observability {
  /** Every source file read, sorted by path. */
  files: ObservabilityFile[];
  /** Logging configuration outside test directories, sorted by path. */
  configs: { path: string; kind: LoggingConfigKind }[];
  /** Source files left out, sorted by path. */
  skipped: { path: string; reason: "vendored" | "generated" | "minified" | ReadSkip }[];
}

export interface ObservabilityOptions {
  /** Git executable; defaults to `git` on PATH. */
  gitBinary?: string;
}

const LEVELS = "trace|debug|info|notice|warn|warning|error|err|fatal|critical|crit|alert|emerg|emergency|exception|severe|fine|finer|finest|log";
// A level method is called with parentheses, or in Ruby with a space and an argument.
const CALLED = String.raw`(?:\s*\(|[ \t]+(?=["'\w:@]))`;

const LOGGING_FORMS: readonly { form: string; pattern: RegExp }[] = [
  { form: "logger call", pattern: new RegExp(String.raw`\b[\w$]*(?:log|logger|Log|Logger|LOG|LOGGER)\s*(?:\.|->|::|\?\.)\s*(?:${LEVELS})\b${CALLED}`, "g") },
  { form: "logging module", pattern: new RegExp(String.raw`\blogging\s*\.\s*(?:${LEVELS})\s*\(`, "g") },
  { form: "error_log", pattern: /(?<![\w>:$])error_log\s*\(/g },
  { form: "phpBB-style log", pattern: /\$(?:phpbb_)?log\s*->\s*add\s*\(|(?<![\w>:$])add_log\s*\(/g },
  { form: "syslog", pattern: /\b(?:syslog|openlog)\s*\(/g },
  { form: "stderr", pattern: /\bfprintf\s*\(\s*stderr\b|\bSystem\.err\.print(?:ln|f)?\s*\(/g },
];
const CONSOLE = /\bconsole\s*\.\s*(?:log|warn|error|info|debug|trace)\s*\(/g;
const IMPORT_LINE = /^\s*(?:import|from|require(?:_relative)?|use|include(?:_once)?|require_once)\b|\brequire\s*\(\s*['"]/;

const CONFIG_FILE = /^(?:log4j2?(?:-[\w-]+)?\.(?:xml|properties|ya?ml|json)|logback(?:-[\w-]+)?\.xml|logging\.(?:properties|conf|ini|ya?ml|json)|[\w-]*logging[\w-]*\.(?:conf|ini|cfg)|monolog\.ya?ml)$/i;
const RAILS_CONFIG = /(?:^|\/)config\/(?:environments\/[\w-]+|application)\.rb$/;
const RAILS_SETTING = /\bconfig\.(?:log_level|logger|log_tags|log_formatter)\b/;
const DJANGO_SETTINGS = /(?:^|\/)(?:settings[\w-]*\.py|settings\/[\w-]+\.py)$/;
const DJANGO_LOGGING = /^LOGGING\s*=/m;
const PYTHON_LOGGING_CONFIG = /\blogging\.config\.(?:dictConfig|fileConfig)\s*\(/;

// C-like languages share Java's comment and string syntax closely enough for stripping.
const C_LIKE = new Set(["c", "cpp", "objc", "csharp", "go", "kotlin", "scala", "rust", "swift", "dart", "groovy"]);
const MINIFIED_LINE = 1000;

const NOTES = [
  "files are those tracked at HEAD; content is read from the working tree; nothing is run",
  "comments and strings are stripped before matching logging calls, for languages with a known syntax",
  "console.log and its siblings are counted apart: in browser code they are debugging output",
  "integrations are read from import lines; manifests are read by the dependency collector",
  `vendored and generated paths are skipped, and so are minified files (a line over ${MINIFIED_LINE} characters)`,
];

const byPath = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const nameOf = (filePath: string) => filePath.slice(filePath.lastIndexOf("/") + 1);

function lexerOf(filePath: string): DynamicFamily | null {
  const family = languageOf(filePath)?.family ?? "";
  return DYNAMIC_CALL_FAMILIES[family] ?? (C_LIKE.has(family) ? "java" : null);
}

const countMatches = (code: string, pattern: RegExp): number => [...code.matchAll(pattern)].length;

function readSource(text: string, filePath: string): { file: ObservabilityFile; config: LoggingConfigKind | null } {
  const lexer = lexerOf(filePath);
  const code = lexer ? stripCode(text, lexer) : text;
  const logging = LOGGING_FORMS.map(({ form, pattern }) => ({ form, calls: countMatches(code, pattern) }))
    .filter((entry) => entry.calls > 0)
    .sort((a, b) => byPath(a.form, b.form));
  const integrations: ObservabilityFile["integrations"] = [];
  text.split("\n").forEach((line, index) => {
    if (!IMPORT_LINE.test(line)) return;
    const integration = integrationOf(line);
    if (integration) integrations.push({ ...integration, line: index + 1 });
  });
  let config: LoggingConfigKind | null = null;
  if (RAILS_CONFIG.test(filePath) && RAILS_SETTING.test(code)) config = "Rails log setting";
  else if (DJANGO_SETTINGS.test(filePath) && DJANGO_LOGGING.test(code)) config = "Django LOGGING";
  else if (extensionOf(filePath) === "py" && PYTHON_LOGGING_CONFIG.test(code)) config = "Python logging config";
  return { file: { path: filePath, logging, console: countMatches(code, CONSOLE), integrations }, config };
}

export function collectObservability(repoPath: string, options: ObservabilityOptions = {}): Measurement<Observability> {
  const evidence: Evidence = { commands: [], notes: [...NOTES] };
  const git = createGitRunner(repoPath, options.gitBinary ?? "git", evidence);
  let entries: TreeEntry[];
  try {
    if (!hasCommits(git)) return { status: "not-measured", reason: "repository has no commits", evidence };
    entries = listTree(git);
  } catch (error) {
    if (error instanceof GitError) return { status: "not-measured", reason: error.message, evidence };
    throw error;
  }

  const realRepo = realpathSync(repoPath);
  const files: ObservabilityFile[] = [];
  const configs: Observability["configs"] = [];
  const skipped: Observability["skipped"] = [];
  for (const entry of entries) {
    const source = SOURCE_EXTENSIONS.has(extensionOf(entry.path));
    // Configuration under src/main/resources is product configuration, so only test directories are left out.
    const outsideTests = !isUnderTestDirectory(entry.path) && !isVendored(entry.path);
    if (!source) {
      if (outsideTests && entry.mode !== "120000" && entry.mode !== "160000" && CONFIG_FILE.test(nameOf(entry.path))) configs.push({ path: entry.path, kind: "configuration file" });
      continue;
    }
    if (isVendored(entry.path)) skipped.push({ path: entry.path, reason: "vendored" });
    else if (isGenerated(entry.path)) skipped.push({ path: entry.path, reason: "generated" });
    else {
      const read = readTrackedFile(realRepo, repoPath, entry, { skipBinary: true });
      if ("skipped" in read) {
        skipped.push({ path: entry.path, reason: read.skipped });
        continue;
      }
      const text = read.content.toString("utf8");
      if (text.split("\n").some((line) => line.length > MINIFIED_LINE)) {
        skipped.push({ path: entry.path, reason: "minified" });
        continue;
      }
      const { file, config } = readSource(text, entry.path);
      files.push(file);
      if (config && outsideTests) configs.push({ path: entry.path, kind: config });
    }
  }
  files.sort((a, b) => byPath(a.path, b.path));
  configs.sort((a, b) => byPath(a.path, b.path));
  skipped.sort((a, b) => byPath(a.path, b.path));
  return { status: "measured", value: { files, configs, skipped }, evidence };
}
