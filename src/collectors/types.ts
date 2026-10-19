// Shared collector output. A collector either measures something and cites how,
// or says plainly that it could not; it never guesses a value.

export interface Evidence {
  /** The exact read-only commands run against the target, in order. */
  commands: string[];
  /** Caveats a reader needs to interpret the value, such as what was excluded. */
  notes: string[];
}

export type Measurement<T> =
  | { status: "measured"; value: T; evidence: Evidence }
  | { status: "not-measured"; reason: string; evidence: Evidence };
