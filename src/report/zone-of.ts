// Which zone a path is in, from a saved report: a red path wins over a yellow path,
// which wins over the module's zone. Shared by mcp and validate. Pure.

import type { ModuleZone, RedPath, YellowPath, Zone } from "../decision/types.js";
import type { AuditReport } from "./model.js";

export interface ZoneAnswer {
  path: string;
  zone: Zone | null;
  /** The module the path falls in; null when none. */
  module: string | null;
  reason: string;
}

function normalize(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
}

function moduleOf(modules: readonly ModuleZone[], filePath: string): ModuleZone | null {
  const directory = filePath.includes("/") ? filePath.slice(0, filePath.lastIndexOf("/")) : "";
  const matches = modules.filter((m) => {
    if (m.module === "(root)") return directory === "";
    if (m.module.endsWith("/(files)")) return directory === m.module.slice(0, -"/(files)".length);
    return filePath.startsWith(`${m.module}/`);
  });
  return matches.sort((a, b) => b.module.length - a.module.length)[0] ?? null;
}

const onRedPath = (red: RedPath, filePath: string) => (red.kind === "file" ? filePath === red.path : filePath.startsWith(`${red.path}/`) || filePath === red.path);

/** A path's zone: a red path wins over a yellow path, which wins over the module's zone. */
export function zoneOf(report: AuditReport, rawPath: string): ZoneAnswer {
  const filePath = normalize(rawPath);
  const module = moduleOf(report.zones.modules, filePath);
  const red = report.zones.redPaths.find((r) => onRedPath(r, filePath));
  if (red) {
    return { path: filePath, zone: "red", module: module?.module ?? null, reason: `on the red path ${red.path}${red.kind === "directory" ? "/" : ""} (${red.term}): agents may only propose changes` };
  }
  const yellow: YellowPath | undefined = report.zones.yellowPaths.find((y) => y.path === filePath);
  if (yellow) return { path: filePath, zone: "yellow", module: yellow.module, reason: yellow.reason };
  if (module) return { path: filePath, zone: module.zone, module: module.module, reason: module.reason };
  const why = report.zones.note ?? "not in any zoned module: tests, docs and directories without source files are not zoned";
  return { path: filePath, zone: null, module: null, reason: why };
}
