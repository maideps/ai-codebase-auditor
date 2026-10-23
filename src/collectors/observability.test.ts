import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createFixtureRepo } from "../testing/git-fixture.js";
import { collectObservability, type Observability } from "./observability.js";

function snapshot(dir: string): string[] {
  const entries: string[] = [];
  const walk = (current: string) => {
    for (const name of readdirSync(current).sort()) {
      const full = path.join(current, name);
      const stats = statSync(full);
      entries.push(`${path.relative(dir, full)} ${stats.size} ${stats.mtimeMs}`);
      if (stats.isDirectory()) walk(full);
    }
  };
  walk(dir);
  return entries;
}

function measured(repo: string): Observability {
  const result = collectObservability(repo);
  if (result.status !== "measured") throw new Error(`expected a measurement, got: ${result.reason}`);
  return result.value;
}

const fileOf = (value: Observability, filePath: string) => value.files.find((file) => file.path === filePath);

describe("collectObservability", () => {
  const repo = createFixtureRepo([
    {
      author: "a@example.com",
      date: "2026-01-01T00:00:00Z",
      files: {
        "app/service.py": [
          "import logging",
          "from opentelemetry import trace",
          "log = logging.getLogger(__name__)",
          "log.info('start')",
          "logging.warning('x')",
          "# logger.info('in a comment')",
          "s = 'logger.error(in a string)'",
          "",
        ].join("\n"),
        "app/logconf.py": "import logging.config\nlogging.config.dictConfig(CONF)\n",
        "web/index.php": "<?php\n$phpbb_log->add('admin', 'LOG_X');\nerror_log('e');\n$this->logger->error('x');\n",
        "src/Main.java": 'import io.sentry.Sentry;\nclass Main { void f() { LOG.debug("x"); System.err.println("e"); } }\n',
        "lib/thing.rb": 'require "sentry-ruby"\nRails.logger.info "x"\nlogger.warn("y")\n',
        "ui/app.js": "console.log('x');\nconsole.error('y');\n",
        "native/main.c": '/* fprintf(stderr, "comment") */\nfprintf(stderr, "x");\nsyslog(LOG_ERR, "y");\n',
        "config/environments/production.rb": "Rails.application.configure do\n  config.log_level = :info\nend\n",
        "mysite/settings.py": "LOGGING = {}\n",
        "config/log4j2.xml": "<Configuration/>\n",
        "test/logback.xml": "<configuration/>\n",
        // Found in the Struts calibration: src/main/resources is product configuration, src/test/resources is not.
        "core/src/main/resources/log4j2.xml": "<Configuration/>\n",
        "core/src/test/resources/log4j2-test.xml": "<Configuration/>\n",
        "vendor/lib.py": "logging.info('vendored')\n",
        "ui/bundle.js": `var a=${"1".repeat(1200)};console.log(a);\n`,
      },
    },
  ]);
  const value = measured(repo);

  it("counts logging calls by form, ignoring comments and strings", () => {
    expect(fileOf(value, "app/service.py")?.logging).toEqual([{ form: "logger call", calls: 1 }, { form: "logging module", calls: 1 }]);
    expect(fileOf(value, "web/index.php")?.logging).toEqual([{ form: "error_log", calls: 1 }, { form: "logger call", calls: 1 }, { form: "phpBB-style log", calls: 1 }]);
    expect(fileOf(value, "src/Main.java")?.logging).toEqual([{ form: "logger call", calls: 1 }, { form: "stderr", calls: 1 }]);
    expect(fileOf(value, "lib/thing.rb")?.logging).toEqual([{ form: "logger call", calls: 2 }]);
    expect(fileOf(value, "native/main.c")?.logging).toEqual([{ form: "stderr", calls: 1 }, { form: "syslog", calls: 1 }]);
  });

  it("counts console output apart from logging", () => {
    expect(fileOf(value, "ui/app.js")).toMatchObject({ logging: [], console: 2 });
  });

  it("finds integrations on import lines, with their line", () => {
    expect(fileOf(value, "app/service.py")?.integrations).toEqual([{ name: "OpenTelemetry", kind: "metrics or tracing", line: 2 }]);
    expect(fileOf(value, "src/Main.java")?.integrations).toEqual([{ name: "Sentry", kind: "error reporting", line: 1 }]);
    expect(fileOf(value, "lib/thing.rb")?.integrations).toEqual([{ name: "Sentry", kind: "error reporting", line: 1 }]);
  });

  it("finds logging configuration files and framework settings outside test directories", () => {
    expect(value.configs).toEqual([
      { path: "app/logconf.py", kind: "Python logging config" },
      { path: "config/environments/production.rb", kind: "Rails log setting" },
      { path: "config/log4j2.xml", kind: "configuration file" },
      { path: "core/src/main/resources/log4j2.xml", kind: "configuration file" },
      { path: "mysite/settings.py", kind: "Django LOGGING" },
    ]);
  });

  it("skips vendored and minified files", () => {
    expect(value.skipped).toEqual([
      { path: "ui/bundle.js", reason: "minified" },
      { path: "vendor/lib.py", reason: "vendored" },
    ]);
  });

  it("records the read-only commands, and leaves the repository unchanged", () => {
    const before = snapshot(repo);
    const result = collectObservability(repo);
    expect(result.evidence.commands).toEqual(["git rev-parse --verify -q HEAD", "git ls-tree -r -z HEAD"]);
    expect(snapshot(repo)).toEqual(before);
  });

  it("reports an empty repository as not measured", () => {
    expect(collectObservability(createFixtureRepo([]))).toMatchObject({ status: "not-measured", reason: "repository has no commits" });
  });
});
