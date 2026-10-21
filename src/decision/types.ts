// Decision outputs: the verdict and where agents may work. Like scoring, the
// decision engine is pure and never reads the repository.

export type VerdictKind = "adopt" | "adapt" | "prepare-first";

export interface Verdict {
  /** Null when the evidence cannot support a verdict. */
  verdict: VerdictKind | null;
  /** The rule that fired, in words. */
  rule: string;
  /** The factor scores behind the rule; null for a factor that is not measured. */
  triggeredBy: { factor: string; score: number | null }[];
  /** True while a blocking factor is not measured. */
  provisional: boolean;
  unmeasuredBlocking: string[];
}

export type Zone = "green" | "yellow" | "red";

export interface ModuleZone {
  /** A directory path; "(root)" for root files, "<dir>/(files)" for files directly in a split directory. */
  module: string;
  zone: Zone;
  reason: string;
  sourceFiles: number;
  /** Source files in the module that sit on a red path. */
  redFiles: number;
}

export interface RedPath {
  /** The shallowest matching directory, or the file when only its name matches. */
  path: string;
  kind: "directory" | "file";
  term: string;
}

export interface Zones {
  modules: ModuleZone[];
  redPaths: RedPath[];
  /** Top-level directories without source files, counted but not zoned. */
  unzoned: string[];
  /** Why no zones could be assigned; null otherwise. */
  note: string | null;
}

export interface Decision {
  verdict: Verdict;
  zones: Zones;
}
