// Call sites whose target is computed at run time, per language family. The
// source is stripped first (see strip.ts), so strings and comments never match.
// A construct whose target is a literal ("name", :name, 0) is visible at the
// call site and is not reported.

import { stripCode, type DynamicFamily } from "./strip.js";

export interface DynamicSite {
  line: number;
  construct: string;
}

interface Construct {
  name: string;
  pattern: RegExp;
  /** Decides whether a match is a site; the match ends where the call's arguments begin. */
  accept?: (code: string, end: number, family: DynamicFamily, matchStart: number) => boolean;
}

const OPEN = "([{";
const CLOSE = ")]}";

// The top-level arguments of a parenthesized call starting at or after `from`; null when there is no "(".
function parenArgs(code: string, from: number): string[] | null {
  let i = from;
  while (code[i] === " " || code[i] === "\t") i += 1;
  if (code[i] !== "(") return null;
  const args: string[] = [];
  let depth = 0;
  let start = i + 1;
  for (let j = i; j < code.length; j += 1) {
    const char = code[j] ?? "";
    if (OPEN.includes(char)) depth += 1;
    else if (CLOSE.includes(char)) {
      depth -= 1;
      if (depth === 0) {
        args.push(code.slice(start, j));
        return args.map((arg) => arg.trim()).filter((arg, index, all) => arg !== "" || all.length > 1 || index > 0);
      }
    } else if (char === "," && depth === 1) {
      args.push(code.slice(start, j));
      start = j + 1;
    }
  }
  return null;
}

// Ruby's call forms: f(a, b) or f a, b (up to the end of the statement or a block).
function rubyArgs(code: string, from: number): string[] {
  const inParens = parenArgs(code, from);
  if (inParens) return inParens;
  if (!/^[ \t]/.test(code.slice(from, from + 1))) return [];
  const rest = code.slice(from);
  const stop = rest.search(/\n|;|\s+do\b|\s*\{/);
  const statement = (stop === -1 ? rest : rest.slice(0, stop)).trim();
  if (statement === "" || statement === "do") return [];
  const args: string[] = [];
  let depth = 0;
  let start = 0;
  for (let j = 0; j < statement.length; j += 1) {
    const char = statement[j] ?? "";
    if (OPEN.includes(char)) depth += 1;
    else if (CLOSE.includes(char)) depth -= 1;
    else if (char === "," && depth === 0) {
      args.push(statement.slice(start, j).trim());
      start = j + 1;
    }
  }
  args.push(statement.slice(start).trim());
  return args;
}

// An UPPER_CASE name, optionally qualified (Names.VFS_JBOSS5), is a constant: its value is one search away.
const CONSTANT = /^(?:[\w$]+\.)*[A-Z][A-Z0-9_]+$/;

function isLiteral(arg: string | undefined, family: DynamicFamily): boolean {
  if (arg === undefined) return false;
  if (arg === '"S"' || CONSTANT.test(arg)) return true;
  if (family === "ruby") return /^:(?:@{0,2}\w+[?!=]?|"S")$/.test(arg);
  if (family === "javascript") return /^\d+$/.test(arg);
  if (family === "php") return /^(?:array\s*\(|\[)[^,]+,\s*"S"\s*[\])]$/.test(arg);
  return false;
}

const argsOf = (code: string, end: number, family: DynamicFamily) => (family === "ruby" ? rubyArgs(code, end) : parenArgs(code, end) ?? []);
const firstComputed = (code: string, end: number, family: DynamicFamily) => {
  const args = argsOf(code, end, family);
  return args.length > 0 && !isLiteral(args[0], family);
};
const secondComputed = (code: string, end: number, family: DynamicFamily) => {
  const args = argsOf(code, end, family);
  return args.length > 1 && !isLiteral(args[1], family);
};
const hasArgs = (code: string, end: number, family: DynamicFamily) => argsOf(code, end, family).length > 0;

// The bracket that the match ends on, with a computed key, followed by a call.
function computedBracketCall(code: string, end: number, family: DynamicFamily): boolean {
  const open = end - 1;
  let depth = 0;
  for (let j = open; j < code.length; j += 1) {
    const char = code[j];
    if (char === "[") depth += 1;
    else if (char === "]" && --depth === 0) {
      const key = code.slice(open + 1, j).trim();
      return !isLiteral(key, family) && /^\s*\(/.test(code.slice(j + 1, j + 20));
    }
    else if (char === "\n") return false;
  }
  return false;
}

const computedBracket = (code: string, end: number, family: DynamicFamily) => {
  const close = code.indexOf("]", end);
  return close !== -1 && !isLiteral(code.slice(end, close).trim(), family);
};

const REFLECT_IMPORT = /^\s*import\s+java\.lang\.reflect\.(?:Method|\*)\s*;/m;
// "Class loadClass(" declares a method: a type name, not an operator or keyword, comes before the name.
const JAVA_DECLARATION = /(?:^|[^\w$.])(?!(?:return|throw|new|else|case|yield)\b)[A-Za-z_$][\w$]*(?:<[^<>()]*>)?(?:\[\])*\s+$/;
const javaCall = (code: string, end: number, family: DynamicFamily, start: number) =>
  !JAVA_DECLARATION.test(code.slice(Math.max(0, start - 80), start)) && firstComputed(code, end, family);

const CONSTRUCTS: Readonly<Record<DynamicFamily, readonly Construct[]>> = {
  python: [
    { name: "getattr by name", pattern: /\b(?:getattr|setattr|delattr)(?=\s*\()/g, accept: secondComputed },
    { name: "__getattr__", pattern: /\bdef\s+__(?:getattr|getattribute)__\b/g },
    { name: "eval or exec", pattern: /(?<![.\w])(?:eval|exec|execfile)(?=\s*\()|(?<![.\w])exec[ \t]+(?=[\w"[])/g },
    { name: "import by name", pattern: /(?<![.\w])__import__(?=\s*\()|\bimport_module(?=\s*\()/g, accept: firstComputed },
    { name: "globals() by name", pattern: /\b(?:globals|locals|vars)\(\)\s*\[/g, accept: computedBracket },
  ],
  php: [
    { name: "call_user_func by name", pattern: /\bcall_user_func(?:_array)?(?=\s*\()/g, accept: firstComputed },
    { name: "variable method", pattern: /(?:->|::)\$\w+(?=\s*\()/g },
    { name: "variable function", pattern: /(?<!\bnew\s+)(?<![\w>:$\\])\$\w+(?=\s*\()/g },
    { name: "new $class", pattern: /\bnew\s+\$\w+/g },
    { name: "variable variable", pattern: /\$\$\w+|\$\{\s*\$/g },
    { name: "__call or __get", pattern: /\bfunction\s+__(?:call|callStatic|get)(?=\s*\()/g },
    { name: "eval", pattern: /(?<![\w>:$])(?:eval|create_function)(?=\s*\()/g },
  ],
  ruby: [
    { name: "send by name", pattern: /\.(?:send|public_send|__send__)\b(?![?!=])/g, accept: firstComputed },
    { name: "method_missing", pattern: /\bdef\s+(?:self\.)?method_missing\b/g },
    { name: "define_method by name", pattern: /\bdefine_(?:singleton_)?method\b/g, accept: firstComputed },
    { name: "eval of a string", pattern: /\b(?:class_eval|instance_eval|module_eval)\b|(?<![.\w])eval\b/g, accept: hasArgs },
    {
      name: "constantize by name",
      pattern: /\.(?:constantize|safe_constantize)\b|\bconst_get\b/g,
      accept: (code, end, family, start) => (code.startsWith("const_get", start) ? firstComputed(code, end, family) : !code.slice(0, start).endsWith('"S"')),
    },
    { name: "instance_variable by name", pattern: /\binstance_variable_(?:get|set)\b/g, accept: firstComputed },
  ],
  java: [
    { name: "Class.forName by name", pattern: /\b(?:Class\.forName|loadClass)(?=\s*\()/g, accept: javaCall },
    { name: "getMethod by name", pattern: /\.(?:getMethod|getDeclaredMethod|getField|getDeclaredField)(?=\s*\()/g, accept: firstComputed },
    { name: "Method.invoke", pattern: /(?<!\b(?:this|super))\.invoke(?=\s*\()/g, accept: (code, end, family) => REFLECT_IMPORT.test(code) && hasArgs(code, end, family) },
    { name: "setAccessible", pattern: /\.setAccessible\s*\(\s*true\b/g },
    { name: "Proxy", pattern: /\bProxy\.newProxyInstance(?=\s*\()/g },
  ],
  javascript: [
    { name: "eval or Function", pattern: /(?<![.\w$])eval(?=\s*\()|\bnew\s+Function(?=\s*\()/g },
    { name: "computed call", pattern: /(?<=[\w$)\]])\[/g, accept: (code, end, family) => computedBracketCall(code, end, family) },
    { name: "Reflect", pattern: /\bReflect\.(?:apply|construct)(?=\s*\()/g },
  ],
};

/** Every site in a source file, in order of position. */
export function findSites(source: string, family: DynamicFamily): DynamicSite[] {
  const code = stripCode(source, family);
  const found: { index: number; construct: string }[] = [];
  for (const construct of CONSTRUCTS[family]) {
    for (const match of code.matchAll(construct.pattern)) {
      const end = match.index + match[0].length;
      if (!construct.accept || construct.accept(code, end, family, match.index)) found.push({ index: match.index, construct: construct.name });
    }
  }
  found.sort((a, b) => a.index - b.index);
  // Line numbers: count newlines once, walking the sorted positions.
  let line = 1;
  let position = 0;
  return found.map(({ index, construct }) => {
    for (; position < index; position += 1) if (code[position] === "\n") line += 1;
    return { line, construct };
  });
}
