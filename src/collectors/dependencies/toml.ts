// A small TOML reader, enough for pyproject.toml dependency sections: tables,
// key/value pairs, strings, arrays (multi-line), inline tables, and bare
// numbers, booleans and dates (returned as strings). Not a full TOML parser.

export type TomlValue = string | number | boolean | TomlValue[] | { [key: string]: TomlValue };
export type TomlTables = Record<string, Record<string, TomlValue>>;

export class TomlError extends Error {}

const unquote = (name: string) => name.replace(/\s+/g, "").replace(/["']/g, "");

export function parseToml(text: string): TomlTables {
  const tables: TomlTables = { "": {} };
  let current = "";
  let i = 0;

  const peek = (offset = 0) => text[i + offset] ?? "";
  const skipInline = () => {
    while (peek() === " " || peek() === "\t") i += 1;
  };
  const skipComment = () => {
    if (peek() === "#") while (i < text.length && peek() !== "\n") i += 1;
  };
  const skipAll = () => {
    for (;;) {
      const before = i;
      while (/\s/.test(peek())) i += 1;
      skipComment();
      if (i === before) return;
    }
  };

  function readString(): string {
    const quote = peek();
    const triple = peek(1) === quote && peek(2) === quote;
    i += triple ? 3 : 1;
    let out = "";
    for (;;) {
      if (i >= text.length) throw new TomlError("unterminated string");
      if (triple ? text.startsWith(quote.repeat(3), i) : peek() === quote) {
        i += triple ? 3 : 1;
        return out;
      }
      if (!triple && peek() === "\n") throw new TomlError("newline in string");
      if (quote === '"' && peek() === "\\") {
        const next = peek(1);
        out += next === "n" ? "\n" : next === "t" ? "\t" : next;
        i += 2;
        continue;
      }
      out += peek();
      i += 1;
    }
  }

  function readValue(): TomlValue {
    const char = peek();
    if (char === '"' || char === "'") return readString();
    if (char === "[") {
      i += 1;
      const items: TomlValue[] = [];
      for (;;) {
        skipAll();
        if (peek() === "]") {
          i += 1;
          return items;
        }
        items.push(readValue());
        skipAll();
        if (peek() === ",") i += 1;
        else if (peek() !== "]") throw new TomlError("expected , or ] in array");
      }
    }
    if (char === "{") {
      i += 1;
      const table: Record<string, TomlValue> = {};
      for (;;) {
        skipInline();
        if (peek() === "}") {
          i += 1;
          return table;
        }
        const key = readKey();
        skipInline();
        table[key] = readValue();
        skipInline();
        if (peek() === ",") i += 1;
        else if (peek() !== "}") throw new TomlError("expected , or } in inline table");
      }
    }
    const start = i;
    while (i < text.length && !/[,\]}\n#]/.test(peek())) i += 1;
    const bare = text.slice(start, i).trim();
    if (bare === "") throw new TomlError("missing value");
    if (bare === "true" || bare === "false") return bare === "true";
    return /^[+-]?\d+(?:\.\d+)?$/.test(bare) ? Number(bare) : bare;
  }

  function readKey(): string {
    if (peek() === '"' || peek() === "'") {
      const key = readString();
      skipInline();
      if (peek() !== "=") throw new TomlError("expected = after key");
      i += 1;
      return key;
    }
    const start = i;
    while (i < text.length && peek() !== "=" && peek() !== "\n") i += 1;
    if (peek() !== "=") throw new TomlError(`expected = after key ${text.slice(start, i).trim()}`);
    const key = text.slice(start, i).trim();
    i += 1;
    return key;
  }

  for (;;) {
    skipAll();
    if (i >= text.length) return tables;
    if (peek() === "[") {
      const arrayTable = peek(1) === "[";
      const end = text.indexOf(arrayTable ? "]]" : "]", i);
      if (end < 0) throw new TomlError("unterminated table header");
      current = unquote(text.slice(i + (arrayTable ? 2 : 1), end));
      tables[current] ??= {};
      i = end + (arrayTable ? 2 : 1);
      continue;
    }
    const key = readKey();
    skipInline();
    const table = tables[current] ?? (tables[current] = {});
    table[key] = readValue();
    skipInline();
    skipComment();
  }
}
