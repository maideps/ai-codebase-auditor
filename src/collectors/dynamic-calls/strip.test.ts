import { describe, expect, it } from "vitest";
import { stripCode } from "./strip.js";

const lines = (text: string) => text.split("\n").length;

describe("stripCode", () => {
  it.each([
    ["python", "x = 1  # eval(a)\ny = 'eval(b)'\n", "x = 1  \ny = \"S\"\n"],
    ["python", 'f"{name}" + f"plain" + rb"raw"', '"I" + "S" + "S"'],
    ["python", "s = '''one\neval(x)\n'''\nz", 's = "S"\n\n\nz'],
    ["ruby", 'a = "#{x}" + "y" # send(x)\n', 'a = "I" + "S" \n'],
    ["ruby", "=begin\nsend(x)\n=end\nok", "\n\n\nok"],
    ["ruby", "q = %q(send(x)) + %Q{#{y}}", 'q = "S" + "I"'],
    ["ruby", "t = <<~SQL\n  send(x)\nSQL\nok", 't = "S"\n\n\nok'],
    ["java", 'a = "x"; // b\nc = \'"\'; /* d\n */ e', 'a = "S"; \nc = "S"; \n e'],
    ["java", 'String s = """\n  Class.forName(x)\n  """;', 'String s = "S"\n\n;'],
    ["javascript", "a = `x${y}` + `z` + 'q' // c", 'a = "I" + "S" + "S" '],
    ["javascript", "r = /it's/g; eval(x)", 'r = "S"g; eval(x)'],
    ["javascript", "a = b / c; d = e / f", "a = b / c; d = e / f"],
  ] as const)("%s: %j", (family, input, expected) => {
    expect(stripCode(input, family)).toBe(expected);
    expect(lines(stripCode(input, family))).toBe(lines(input));
  });

  it("php: text outside the PHP tags is inert, and strings interpolate only in double quotes", () => {
    const input = "<p>It's $x()</p>\n<?php $a = 'it''s'; $b = \"$c\"; $d = \"plain\"; # x()\n?>\n<b>don't</b><?= $e ?>";
    const stripped = stripCode(input, "php");
    expect(stripped).toBe('\n $a = "S""S"; $b = "I"; $d = "S"; \n\n $e ');
    expect(lines(stripped)).toBe(lines(input));
  });

  it("php: heredocs interpolate, nowdocs do not, and #[attributes] are code", () => {
    const input = "<?php\n$a = <<<EOT\n$x()\nEOT;\n$b = <<<'EOT'\n$y()\nEOT;\n#[Attr]\nf();";
    expect(stripCode(input, "php")).toBe('\n$a = "I"\n\n;\n$b = "S"\n\n;\n#[Attr]\nf();');
  });

  it("keeps escaped quotes inside strings and an unterminated string ends at the line", () => {
    expect(stripCode('a = "x\\"y"; b', "java")).toBe('a = "S"; b');
    expect(stripCode("a = 'x\nb = 1", "python")).toBe('a = "S"\nb = 1');
  });
});
