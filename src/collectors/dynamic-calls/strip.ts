// Removes comments and replaces string literals with a placeholder, so call
// patterns never match text inside strings or comments. A string becomes "S",
// or "I" when it interpolates (its content is computed). Every newline is kept,
// so line numbers in the stripped text match the original. This is a small
// lexer per language family, not a parser: unusual syntax may be misread.

import type { DynamicFamily } from "../../file-kinds.js";

export type { DynamicFamily };

const LITERAL = '"S"';
const INTERPOLATED = '"I"';
const newlinesOf = (text: string) => text.replace(/[^\n]/g, "");

// After these characters (or at the start), a slash starts a regex literal, not a division.
const REGEX_AFTER = new Set(["", "(", ",", "=", ":", "[", "!", "&", "|", "?", "{", "}", ";", "+", "-", "*", "%", "<", ">", "~", "^"]);
const REGEX_AFTER_WORDS = /(?:^|[^\w$])(?:return|typeof|case|do|else|in|of|new|delete|void|throw|when|if|unless|and|or|not)$/;

const PERCENT_CLOSE: Readonly<Record<string, string>> = { "(": ")", "{": "}", "[": "]", "<": ">" };

interface State {
  text: string;
  i: number;
  out: string;
}

// Checks look at the end of the output only: scanning all of it at every quote or slash is quadratic.
const tail = (out: string) => out.slice(-40);

function lastSignificant(out: string): string {
  const trimmed = tail(out).trimEnd();
  return trimmed[trimmed.length - 1] ?? "";
}

// A quoted string from i (at the opening quote); returns the end index past the closing quote.
function scanQuoted(text: string, start: number, quote: string, multiline: boolean, rubyInterpolation: boolean): { end: number; body: string } {
  let j = start + quote.length;
  while (j < text.length && !text.startsWith(quote, j)) {
    const char = text[j];
    if (char === "\\") j += 2;
    else if (char === "\n" && !multiline) return { end: j, body: text.slice(start + quote.length, j) };
    else if (rubyInterpolation && char === "#" && text[j + 1] === "{") j = skipBraces(text, j + 1);
    else j += 1;
  }
  return { end: Math.min(text.length, j + quote.length), body: text.slice(start + quote.length, j) };
}

// From an opening brace, the index past its matching closing brace.
function skipBraces(text: string, open: number): number {
  let depth = 0;
  for (let j = open; j < text.length; j += 1) {
    if (text[j] === "{") depth += 1;
    else if (text[j] === "}" && --depth === 0) return j + 1;
  }
  return text.length;
}

function emitString(state: State, end: number, interpolated: boolean): void {
  state.out += (interpolated ? INTERPOLATED : LITERAL) + newlinesOf(state.text.slice(state.i, end));
  state.i = end;
}

// A regex literal from i (at the slash), or null when the line ends first (it was a division).
function scanRegex(text: string, start: number): number | null {
  let inClass = false;
  for (let j = start + 1; j < text.length; j += 1) {
    const char = text[j];
    if (char === "\n") return null;
    if (char === "\\") j += 1;
    else if (char === "[") inClass = true;
    else if (char === "]") inClass = false;
    else if (char === "/" && !inClass) return j + 1;
  }
  return null;
}

function regexAllowed(out: string): boolean {
  return REGEX_AFTER.has(lastSignificant(out)) || REGEX_AFTER_WORDS.test(tail(out).trimEnd());
}

function stripPython(text: string): string {
  const state: State = { text, i: 0, out: "" };
  while (state.i < text.length) {
    const char = text[state.i] ?? "";
    if (char === "#") {
      while (state.i < text.length && text[state.i] !== "\n") state.i += 1;
      continue;
    }
    if (char === "'" || char === '"') {
      const prefix = /(?:^|[^\w])([rRbBuUfF]{1,2})$/.exec(tail(state.out))?.[1] ?? "";
      state.out = state.out.slice(0, state.out.length - prefix.length);
      const quote = text.startsWith(char.repeat(3), state.i) ? char.repeat(3) : char;
      const { end, body } = scanQuoted(text, state.i, quote, quote.length === 3, false);
      emitString(state, end, /f/i.test(prefix) && body.includes("{"));
      continue;
    }
    state.out += char;
    state.i += 1;
  }
  return state.out;
}

function stripCLike(text: string, family: "java" | "javascript"): string {
  const state: State = { text, i: 0, out: "" };
  while (state.i < text.length) {
    const char = text[state.i] ?? "";
    if (text.startsWith("//", state.i)) {
      while (state.i < text.length && text[state.i] !== "\n") state.i += 1;
      continue;
    }
    if (text.startsWith("/*", state.i)) {
      const close = text.indexOf("*/", state.i + 2);
      const end = close === -1 ? text.length : close + 2;
      state.out += newlinesOf(text.slice(state.i, end));
      state.i = end;
      continue;
    }
    if (family === "java" && text.startsWith('"""', state.i)) {
      emitString(state, scanQuoted(text, state.i, '"""', true, false).end, false);
      continue;
    }
    if (char === '"' || char === "'" || (family === "javascript" && char === "`")) {
      const { end, body } = scanQuoted(text, state.i, char, char === "`", false);
      emitString(state, end, char === "`" && body.includes("${"));
      continue;
    }
    if (family === "javascript" && char === "/" && regexAllowed(state.out)) {
      const end = scanRegex(text, state.i);
      if (end !== null) {
        emitString(state, end, false);
        continue;
      }
    }
    state.out += char;
    state.i += 1;
  }
  return state.out;
}

function stripPhp(text: string): string {
  const state: State = { text, i: 0, out: "" };
  let code = false;
  while (state.i < text.length) {
    const char = text[state.i] ?? "";
    if (!code) {
      const open = /<\?(?:php\b|=|\s)/.exec(text.slice(state.i));
      const start = open ? state.i + open.index : text.length;
      state.out += newlinesOf(text.slice(state.i, start));
      state.i = open ? start + (open[0].trimEnd().length) : text.length;
      code = open !== null;
      continue;
    }
    if (text.startsWith("?>", state.i)) {
      code = false;
      state.i += 2;
      continue;
    }
    if (text.startsWith("//", state.i) || (char === "#" && text[state.i + 1] !== "[")) {
      while (state.i < text.length && text[state.i] !== "\n" && !text.startsWith("?>", state.i)) state.i += 1;
      continue;
    }
    if (text.startsWith("/*", state.i)) {
      const close = text.indexOf("*/", state.i + 2);
      const end = close === -1 ? text.length : close + 2;
      state.out += newlinesOf(text.slice(state.i, end));
      state.i = end;
      continue;
    }
    const heredoc = /^<<<[ \t]*(['"]?)([A-Za-z_]\w*)\1\r?\n/.exec(text.slice(state.i, state.i + 200));
    if (heredoc) {
      const id = heredoc[2] ?? "";
      const bodyStart = state.i + heredoc[0].length;
      const terminator = new RegExp(`^[ \\t]*${id}\\b`, "m");
      const found = terminator.exec(text.slice(bodyStart));
      const end = found ? bodyStart + found.index + found[0].length : text.length;
      const body = text.slice(bodyStart, found ? bodyStart + found.index : text.length);
      emitString(state, end, heredoc[1] !== "'" && /\$[A-Za-z_{]|\{\$/.test(body));
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      const { end, body } = scanQuoted(text, state.i, char, true, false);
      emitString(state, end, char !== "'" && /\$[A-Za-z_{]|\{\$/.test(body));
      continue;
    }
    state.out += char;
    state.i += 1;
  }
  return state.out;
}

function stripRuby(text: string): string {
  const state: State = { text, i: 0, out: "" };
  const pending: string[] = [];
  while (state.i < text.length) {
    const char = text[state.i] ?? "";
    const lineStart = state.i === 0 || text[state.i - 1] === "\n";
    if (lineStart && text.startsWith("=begin", state.i)) {
      const close = /^=end\b.*$/m.exec(text.slice(state.i));
      const end = close ? state.i + close.index + close[0].length : text.length;
      state.out += newlinesOf(text.slice(state.i, end));
      state.i = end;
      continue;
    }
    if (char === "\n" && pending.length > 0) {
      // Heredoc bodies start on the line after their opener.
      let j = state.i + 1;
      for (const id of pending.splice(0)) {
        while (j < text.length) {
          const next = text.indexOf("\n", j);
          const line = text.slice(j, next === -1 ? text.length : next);
          j = next === -1 ? text.length : next + 1;
          if (line.trim() === id) break;
        }
      }
      state.out += newlinesOf(text.slice(state.i, j - (text[j - 1] === "\n" ? 1 : 0)));
      state.i = j - (text[j - 1] === "\n" ? 1 : 0);
      continue;
    }
    if (char === "#") {
      while (state.i < text.length && text[state.i] !== "\n") state.i += 1;
      continue;
    }
    const heredoc = /^<<([~-]?)(['"]?)([A-Z_][A-Za-z0-9_]*)\2/.exec(text.slice(state.i, state.i + 100));
    if (heredoc && !/[\w)\]]$/.test(tail(state.out))) {
      const id = heredoc[3] ?? "";
      const bodyStart = text.indexOf("\n", state.i);
      const bodyEnd = bodyStart === -1 ? -1 : new RegExp(`^[ \\t]*${id}[ \\t]*$`, "m").exec(text.slice(bodyStart + 1))?.index ?? -1;
      const body = bodyStart === -1 || bodyEnd === -1 ? "" : text.slice(bodyStart + 1, bodyStart + 1 + bodyEnd);
      pending.push(id);
      state.out += heredoc[2] !== "'" && body.includes("#{") ? INTERPOLATED : LITERAL;
      state.i += heredoc[0].length;
      continue;
    }
    const percent = /^%([qQwWiIr]?)([({[<|!/])/.exec(text.slice(state.i, state.i + 3));
    if (percent && !/[\w)\]}]$/.test(tail(state.out).trimEnd())) {
      const open = percent[2] ?? "(";
      const close = PERCENT_CLOSE[open] ?? open;
      let depth = 0;
      let j = state.i + percent[0].length - 1;
      for (; j < text.length; j += 1) {
        if (text[j] === "\\") j += 1;
        else if (text[j] === open && close !== open) depth += 1;
        else if (text[j] === close && (close === open ? j > state.i + percent[0].length - 1 : --depth === 0)) break;
      }
      const end = Math.min(text.length, j + 1);
      const kind = percent[1] ?? "";
      emitString(state, end, (kind === "" || kind === "Q" || kind === "W" || kind === "I" || kind === "r") && text.slice(state.i, end).includes("#{"));
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      const { end, body } = scanQuoted(text, state.i, char, true, char !== "'");
      emitString(state, end, char !== "'" && body.includes("#{"));
      continue;
    }
    if (char === "/" && regexAllowed(state.out)) {
      const end = scanRegex(text, state.i);
      if (end !== null) {
        emitString(state, end, false);
        continue;
      }
    }
    state.out += char;
    state.i += 1;
  }
  return state.out;
}

export function stripCode(text: string, family: DynamicFamily): string {
  switch (family) {
    case "python":
      return stripPython(text);
    case "php":
      return stripPhp(text);
    case "ruby":
      return stripRuby(text);
    case "java":
    case "javascript":
      return stripCLike(text, family);
  }
}
