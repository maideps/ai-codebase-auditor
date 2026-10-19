// Validation outcome shared across modules. Failures carry every problem found,
// so the user can fix them in one pass instead of one per run.
export type Result<T> = { ok: true; value: T } | { ok: false; errors: string[] };
