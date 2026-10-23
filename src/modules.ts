// Modules: top-level directories, split while one holds more than a share of
// the files, down to a depth limit. Shared by the risk zones and the
// module-boundaries score, so both talk about the same units. Pure.

export const ROOT_MODULE = "(root)";
const OWN_FILES = "/(files)";

export interface ModuleSettings {
  /** A module holding more than this share of all files is split into its subdirectories. */
  splitShare: number;
  /** Modules are never split below this depth. */
  maxDepth: number;
}

/** Module name → its files, splitting any module over the share limit into its subdirectories. */
export function groupModules(paths: readonly string[], settings: ModuleSettings): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  const add = (name: string, file: string) => groups.set(name, [...(groups.get(name) ?? []), file]);
  for (const file of paths) add(file.includes("/") ? (file.split("/")[0] ?? ROOT_MODULE) : ROOT_MODULE, file);
  let split = true;
  while (split) {
    split = false;
    for (const [name, files] of [...groups.entries()]) {
      const depth = name.split("/").length;
      if (name === ROOT_MODULE || name.endsWith(OWN_FILES) || depth >= settings.maxDepth || files.length / paths.length <= settings.splitShare) continue;
      const children = new Map<string, string[]>();
      for (const file of files) {
        const rest = file.slice(name.length + 1);
        const child = rest.includes("/") ? `${name}/${rest.split("/")[0] ?? ""}` : `${name}${OWN_FILES}`;
        children.set(child, [...(children.get(child) ?? []), file]);
      }
      if (![...children.keys()].some((child) => !child.endsWith(OWN_FILES))) continue; // no subdirectories to split into
      groups.delete(name);
      for (const [child, childFiles] of children) groups.set(child, childFiles);
      split = true;
    }
  }
  return groups;
}

/**
 * The module a path belongs to, among the given module names: the deepest one
 * whose directory contains it. Null for a path outside every module, such as
 * a file in a directory that no longer exists.
 */
export function moduleContaining(filePath: string, modules: readonly string[]): string | null {
  let best: string | null = null;
  for (const name of modules) {
    let inside: boolean;
    if (name === ROOT_MODULE) inside = !filePath.includes("/");
    else if (name.endsWith(OWN_FILES)) {
      const dir = name.slice(0, -OWN_FILES.length);
      inside = filePath.startsWith(`${dir}/`) && !filePath.slice(dir.length + 1).includes("/");
    } else inside = filePath.startsWith(`${name}/`);
    if (inside && (best === null || name.length > best.length)) best = name;
  }
  return best;
}
