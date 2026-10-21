import { describe, expect, it } from "vitest";
import { isUnsupportedManifest, parseManifest, type ParsedManifest } from "./parsers.js";

function parsed(filePath: string, text: string): ParsedManifest {
  const result = parseManifest(filePath, text);
  if (result === null) throw new Error(`${filePath} was not recognized`);
  if ("error" in result) throw new Error(result.error);
  return result;
}

describe("package.json", () => {
  it("reads every dependency group and engines.node", () => {
    const manifest = parsed("package.json", JSON.stringify({
      engines: { node: ">=14" },
      dependencies: { express: "^4.18.0" },
      devDependencies: { jest: "29.7.0" },
      optionalDependencies: { fsevents: "*" },
      peerDependencies: { react: ">=17" },
    }));
    expect(manifest).toEqual({
      ecosystem: "npm",
      dependencies: [
        { name: "express", spec: "^4.18.0", scope: "runtime" },
        { name: "fsevents", spec: "*", scope: "optional" },
        { name: "jest", spec: "29.7.0", scope: "development" },
        { name: "react", spec: ">=17", scope: "peer" },
      ],
      runtimes: [{ runtime: "node", spec: ">=14", via: "engines.node" }],
      issues: [],
    });
  });

  it("reports invalid JSON", () => {
    expect(parseManifest("package.json", "{ nope")).toEqual({ error: "invalid JSON" });
  });
});

describe("requirements files", () => {
  it("parses names, extras, specs and markers, skipping options and comments", () => {
    const manifest = parsed("requirements-dev.txt", [
      "# pinned",
      "Django==1.11.29  # old",
      "requests[security]>=2.20,<3",
      "six",
      'pywin32>=300; sys_platform == "win32"',
      "-r base.txt",
      "--index-url https://example.com/simple",
      "-e git+https://github.com/x/y.git#egg=y",
      "",
    ].join("\n"));
    expect(manifest.ecosystem).toBe("pip");
    expect(manifest.dependencies).toEqual([
      { name: "Django", spec: "==1.11.29", scope: "runtime" },
      { name: "pywin32", spec: ">=300", scope: "runtime" },
      { name: "requests", spec: ">=2.20,<3", scope: "runtime" },
      { name: "six", spec: null, scope: "runtime" },
    ]);
    expect(manifest.issues).toEqual(["line 8: editable or URL requirement not parsed"]);
  });

  it("recognizes files in a requirements directory", () => {
    expect(parsed("requirements/prod.txt", "flask\n").dependencies).toEqual([{ name: "flask", spec: null, scope: "runtime" }]);
  });
});

describe("setup.py", () => {
  it("reads literal install_requires, python_requires and version classifiers without running it", () => {
    const manifest = parsed("setup.py", [
      "from setuptools import setup",
      "setup(",
      "    name='moin',",
      "    python_requires='>=2.6',",
      "    install_requires=[",
      "        'werkzeug>=0.8',",
      '        "pygments",',
      "    ],",
      "    classifiers=[",
      "        'Programming Language :: Python :: 2.6',",
      "        'Programming Language :: Python :: 2.7',",
      "        'Programming Language :: Python :: 3',",
      "    ],",
      ")",
    ].join("\n"));
    expect(manifest.dependencies).toEqual([
      { name: "pygments", spec: null, scope: "runtime" },
      { name: "werkzeug", spec: ">=0.8", scope: "runtime" },
    ]);
    expect(manifest.runtimes).toEqual([
      { runtime: "python", spec: ">=2.6", via: "python_requires" },
      { runtime: "python", spec: "2.6", via: "classifier" },
      { runtime: "python", spec: "2.7", via: "classifier" },
    ]);
  });

  it("flags install_requires that is not a literal list", () => {
    expect(parsed("setup.py", "setup(install_requires=REQUIREMENTS)\n").issues).toEqual([
      "install_requires is not a literal list; not parsed",
    ]);
  });
});

describe("pyproject.toml", () => {
  it("reads PEP 621 dependencies and requires-python", () => {
    const manifest = parsed("pyproject.toml", [
      "[project]",
      'name = "x"',
      'requires-python = ">=3.8"',
      "dependencies = [",
      '  "httpx>=0.24",  # comment',
      "  'rich',",
      "]",
      "",
      "[project.optional-dependencies]",
      'test = ["pytest>=7"]',
    ].join("\n"));
    expect(manifest.dependencies).toEqual([
      { name: "httpx", spec: ">=0.24", scope: "runtime" },
      { name: "pytest", spec: ">=7", scope: "optional" },
      { name: "rich", spec: null, scope: "runtime" },
    ]);
    expect(manifest.runtimes).toEqual([{ runtime: "python", spec: ">=3.8", via: "requires-python" }]);
  });

  it("reads Poetry dependencies, groups and the python constraint", () => {
    const manifest = parsed("pyproject.toml", [
      "[tool.poetry.dependencies]",
      'python = "^3.9"',
      'requests = "^2.31"',
      'django = { version = "~4.2", extras = ["bcrypt"] }',
      "",
      "[tool.poetry.group.dev.dependencies]",
      'black = "*"',
    ].join("\n"));
    expect(manifest.dependencies).toEqual([
      { name: "black", spec: "*", scope: "development" },
      { name: "django", spec: "~4.2", scope: "runtime" },
      { name: "requests", spec: "^2.31", scope: "runtime" },
    ]);
    expect(manifest.runtimes).toEqual([{ runtime: "python", spec: "^3.9", via: "tool.poetry.dependencies.python" }]);
  });
});

describe("composer.json", () => {
  it("reads require and require-dev, treating php and extensions as platform", () => {
    const manifest = parsed("composer.json", JSON.stringify({
      require: { php: "^7.2 || ^8.0", "ext-json": "*", "symfony/console": "^5.4" },
      "require-dev": { "phpunit/phpunit": "^9.5" },
      config: { platform: { php: "7.2.5" } },
    }));
    expect(manifest.dependencies).toEqual([
      { name: "phpunit/phpunit", spec: "^9.5", scope: "development" },
      { name: "symfony/console", spec: "^5.4", scope: "runtime" },
    ]);
    expect(manifest.runtimes).toEqual([
      { runtime: "php", spec: "^7.2 || ^8.0", via: "require.php" },
      { runtime: "php", spec: "7.2.5", via: "config.platform.php" },
    ]);
  });
});

describe("Gemfile", () => {
  it("reads gems, groups, the ruby directive and flags gemspec", () => {
    const manifest = parsed("Gemfile", [
      "source 'https://rubygems.org'",
      "ruby '2.7.2'",
      "gemspec",
      "gem 'rails', '~> 6.1', '>= 6.1.4'",
      'gem "pg"',
      "group :development, :test do",
      "  gem 'rspec-rails'",
      "  platforms :mri do",
      "    gem 'byebug'",
      "  end",
      "end",
      "gem 'rubocop', require: false, group: :development",
    ].join("\n"));
    expect(manifest.dependencies).toEqual([
      { name: "byebug", spec: null, scope: "development" },
      { name: "pg", spec: null, scope: "runtime" },
      { name: "rails", spec: "~> 6.1, >= 6.1.4", scope: "runtime" },
      { name: "rspec-rails", spec: null, scope: "development" },
      { name: "rubocop", spec: null, scope: "development" },
    ]);
    expect(manifest.runtimes).toEqual([{ runtime: "ruby", spec: "2.7.2", via: "ruby directive" }]);
    expect(manifest.issues).toEqual(["dependencies declared in a gemspec are not parsed"]);
  });
});

describe("pom.xml", () => {
  it("reads dependencies with property versions, test scope, the Java level and a parent", () => {
    const manifest = parsed("pom.xml", `<project>
  <!-- <dependency><artifactId>commented-out</artifactId></dependency> -->
  <parent><groupId>org.apache</groupId><artifactId>apache</artifactId><version>23</version></parent>
  <properties>
    <maven.compiler.source>1.8</maven.compiler.source>
    <ognl.version>3.1.29</ognl.version>
  </properties>
  <dependencies>
    <dependency><groupId>ognl</groupId><artifactId>ognl</artifactId><version>\${ognl.version}</version></dependency>
    <dependency>
      <groupId>junit</groupId><artifactId>junit</artifactId><version>4.13.2</version><scope>test</scope>
    </dependency>
    <dependency><groupId>x</groupId><artifactId>managed</artifactId></dependency>
    <dependency><groupId>y</groupId><artifactId>unknown</artifactId><version>\${missing.version}</version></dependency>
  </dependencies>
</project>`);
    expect(manifest.ecosystem).toBe("maven");
    expect(manifest.dependencies).toEqual([
      { name: "junit:junit", spec: "4.13.2", scope: "development" },
      { name: "ognl:ognl", spec: "3.1.29", scope: "runtime" },
      { name: "x:managed", spec: null, scope: "runtime" },
      { name: "y:unknown", spec: "${missing.version}", scope: "runtime" },
    ]);
    expect(manifest.runtimes).toEqual([{ runtime: "java", spec: "1.8", via: "maven.compiler.source" }]);
    expect(manifest.issues).toEqual([
      "inherits from a parent POM (org.apache:apache); inherited dependencies and properties are not resolved",
      "unresolved property ${missing.version}",
    ]);
  });

  it("reads the Java level from the compiler plugin", () => {
    const manifest = parsed("pom.xml", `<project><build><plugins><plugin>
      <artifactId>maven-compiler-plugin</artifactId><configuration><release>17</release></configuration>
    </plugin></plugins></build></project>`);
    expect(manifest.runtimes).toEqual([{ runtime: "java", spec: "17", via: "maven-compiler-plugin release" }]);
  });
});

describe("build.gradle", () => {
  it("reads string and map notation, test configurations and the Java level", () => {
    const manifest = parsed("build.gradle", [
      "sourceCompatibility = JavaVersion.VERSION_1_8",
      "dependencies {",
      "  implementation 'org.springframework:spring-core:5.3.20'",
      '  testImplementation("junit:junit:4.13.2")',
      "  compile group: 'commons-io', name: 'commons-io', version: '2.6'",
      "  api 'com.google.guava:guava'",
      "}",
    ].join("\n"));
    expect(manifest.ecosystem).toBe("gradle");
    expect(manifest.dependencies).toEqual([
      { name: "com.google.guava:guava", spec: null, scope: "runtime" },
      { name: "commons-io:commons-io", spec: "2.6", scope: "runtime" },
      { name: "junit:junit", spec: "4.13.2", scope: "development" },
      { name: "org.springframework:spring-core", spec: "5.3.20", scope: "runtime" },
    ]);
    expect(manifest.runtimes).toEqual([{ runtime: "java", spec: "1.8", via: "sourceCompatibility" }]);
  });

  it("reads a Kotlin DSL toolchain", () => {
    expect(parsed("build.gradle.kts", "java { toolchain { languageVersion.set(JavaLanguageVersion.of(21)) } }\n").runtimes).toEqual([
      { runtime: "java", spec: "21", via: "toolchain languageVersion" },
    ]);
  });
});

describe("runtime version files", () => {
  it.each([
    [".nvmrc", "v16.20.0\n", [{ runtime: "node", spec: "v16.20.0", via: ".nvmrc" }]],
    [".node-version", "20\n", [{ runtime: "node", spec: "20", via: ".node-version" }]],
    [".python-version", "3.8.10\n", [{ runtime: "python", spec: "3.8.10", via: ".python-version" }]],
    ["runtime.txt", "python-3.7.2\n", [{ runtime: "python", spec: "python-3.7.2", via: "runtime.txt" }]],
    [".ruby-version", "ruby-2.6.10\n", [{ runtime: "ruby", spec: "ruby-2.6.10", via: ".ruby-version" }]],
    [
      ".tool-versions",
      "nodejs 18.19.0\n# comment\npython 3.11.4 3.10.12\nruby 3.2.2\njava temurin-17.0.1+12\nterraform 1.5.0\n",
      [
        { runtime: "node", spec: "18.19.0", via: ".tool-versions" },
        { runtime: "python", spec: "3.11.4", via: ".tool-versions" },
        { runtime: "ruby", spec: "3.2.2", via: ".tool-versions" },
        { runtime: "java", spec: "temurin-17.0.1+12", via: ".tool-versions" },
      ],
    ],
  ])("%s", (file, text, runtimes) => {
    const manifest = parsed(file, text);
    expect(manifest.ecosystem).toBe("runtime-file");
    expect(manifest.runtimes).toEqual(runtimes);
  });
});

describe("unsupported manifests", () => {
  it.each(["go.mod", "Cargo.toml", "Pipfile", "app/App.csproj", "packages.config", "x.gemspec", "build.sbt", "environment.yml"])(
    "%s is listed as unsupported",
    (file) => {
      expect(parseManifest(file, "")).toBeNull();
      expect(isUnsupportedManifest(file)).toBe(true);
    },
  );

  it("ignores ordinary files", () => {
    expect(parseManifest("src/main.c", "")).toBeNull();
    expect(isUnsupportedManifest("src/main.c")).toBe(false);
  });
});
