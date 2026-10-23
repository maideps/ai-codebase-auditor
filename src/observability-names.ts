// Names that mark observability: error reporters, metrics and tracing clients,
// and frameworks that log by default. Matched on manifest dependency names and
// on import lines. Shared by the observability collector and its scoring rule.
// Pure data; add new libraries here, each with a test.

export type IntegrationKind = "error reporting" | "metrics or tracing";

export interface Integration {
  name: string;
  kind: IntegrationKind;
}

// A name segment: the token is delimited by start, end or a separator, so "raven" does not match "ravendb".
const token = (words: string) => new RegExp(String.raw`(?:^|[\s/@:._'"-])(?:${words})(?=$|[\s/@:._'";-])`, "i");

const INTEGRATIONS: readonly (Integration & { pattern: RegExp })[] = [
  { name: "Sentry", kind: "error reporting", pattern: token("sentry|sentry_sdk|raven") },
  { name: "Bugsnag", kind: "error reporting", pattern: token("bugsnag") },
  { name: "Rollbar", kind: "error reporting", pattern: token("rollbar") },
  { name: "Honeybadger", kind: "error reporting", pattern: token("honeybadger") },
  { name: "Airbrake", kind: "error reporting", pattern: token("airbrake") },
  { name: "Prometheus", kind: "metrics or tracing", pattern: token("prometheus|prometheus_client|prom-client") },
  { name: "Micrometer", kind: "metrics or tracing", pattern: token("micrometer") },
  { name: "StatsD", kind: "metrics or tracing", pattern: token("statsd|dogstatsd") },
  { name: "Dropwizard Metrics", kind: "metrics or tracing", pattern: /io\.dropwizard\.metrics|com\.codahale\.metrics/i },
  { name: "New Relic", kind: "metrics or tracing", pattern: token("newrelic|new_relic") },
  { name: "Datadog", kind: "metrics or tracing", pattern: token("ddtrace|dd-trace|datadog") },
  { name: "AppSignal", kind: "metrics or tracing", pattern: token("appsignal") },
  { name: "Elastic APM", kind: "metrics or tracing", pattern: token("elastic-apm|elasticapm") },
  { name: "OpenTelemetry", kind: "metrics or tracing", pattern: token("opentelemetry") },
  { name: "OpenTracing", kind: "metrics or tracing", pattern: token("opentracing") },
  { name: "Jaeger", kind: "metrics or tracing", pattern: token("jaeger|jaeger-client") },
  { name: "Zipkin", kind: "metrics or tracing", pattern: token("zipkin") },
];

/** The integration a dependency name or import line names, or null. */
export function integrationOf(text: string): Integration | null {
  const found = INTEGRATIONS.find((integration) => integration.pattern.test(text));
  return found ? { name: found.name, kind: found.kind } : null;
}

const FRAMEWORKS: readonly { name: string; pattern: RegExp }[] = [
  { name: "Rails", pattern: /^(?:rails|railties)$/i },
  { name: "Django", pattern: /^django$/i },
  { name: "Spring Boot", pattern: /(?:^|:)spring-boot-starter(?:-[\w-]+)?$/i },
  { name: "Laravel", pattern: /^laravel\/framework$/i },
  { name: "Symfony", pattern: /^symfony\/framework-bundle$/i },
];

/** The framework a dependency name is, when that framework logs requests and errors by default; otherwise null. */
export function loggingFrameworkOf(dependencyName: string): string | null {
  return FRAMEWORKS.find((framework) => framework.pattern.test(dependencyName))?.name ?? null;
}
