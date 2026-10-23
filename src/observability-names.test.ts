import { describe, expect, it } from "vitest";
import { integrationOf, loggingFrameworkOf } from "./observability-names.js";

describe("integrationOf", () => {
  it.each([
    // Error reporting, in each ecosystem's naming style.
    ["sentry-sdk", "Sentry", "error reporting"],
    ["@sentry/node", "Sentry", "error reporting"],
    ["io.sentry:sentry-spring-boot-starter", "Sentry", "error reporting"],
    ["sentry/sentry", "Sentry", "error reporting"],
    ["raven", "Sentry", "error reporting"],
    ["bugsnag-ruby", "Bugsnag", "error reporting"],
    ["rollbar/rollbar", "Rollbar", "error reporting"],
    ["honeybadger", "Honeybadger", "error reporting"],
    ["airbrake", "Airbrake", "error reporting"],
    // Metrics and tracing.
    ["prometheus_client", "Prometheus", "metrics or tracing"],
    ["prom-client", "Prometheus", "metrics or tracing"],
    ["io.micrometer:micrometer-core", "Micrometer", "metrics or tracing"],
    ["statsd", "StatsD", "metrics or tracing"],
    ["io.dropwizard.metrics:metrics-core", "Dropwizard Metrics", "metrics or tracing"],
    ["newrelic", "New Relic", "metrics or tracing"],
    ["ddtrace", "Datadog", "metrics or tracing"],
    ["appsignal", "AppSignal", "metrics or tracing"],
    ["elastic-apm-node", "Elastic APM", "metrics or tracing"],
    ["@opentelemetry/api", "OpenTelemetry", "metrics or tracing"],
    ["io.opentracing:opentracing-api", "OpenTracing", "metrics or tracing"],
    ["jaeger-client", "Jaeger", "metrics or tracing"],
    ["io.zipkin.brave:brave", "Zipkin", "metrics or tracing"],
    // Import lines work too.
    ["import sentry_sdk", "Sentry", "error reporting"],
    ["import io.opentelemetry.api.trace.Tracer;", "OpenTelemetry", "metrics or tracing"],
  ])("%s → %s", (text, name, kind) => {
    expect(integrationOf(text)).toEqual({ name, kind });
  });

  it.each(["ravendb", "sentryish-thing-unrelated", "metrics-core", "log4j-core", "commons-logging"])("leaves %s alone", (text) => {
    expect(integrationOf(text)).toBeNull();
  });
});

describe("loggingFrameworkOf", () => {
  it.each([
    ["rails", "Rails"],
    ["railties", "Rails"],
    ["Django", "Django"],
    ["org.springframework.boot:spring-boot-starter-web", "Spring Boot"],
    ["laravel/framework", "Laravel"],
    ["symfony/framework-bundle", "Symfony"],
  ])("%s → %s", (name, framework) => {
    expect(loggingFrameworkOf(name)).toBe(framework);
  });

  it.each(["rails-html-sanitizer", "django-environ", "symfony/http-kernel", "spring-core"])("leaves %s alone", (name) => {
    expect(loggingFrameworkOf(name)).toBeNull();
  });
});
