import js from "@eslint/js";
import tseslint from "typescript-eslint";

// Product code only: `npm run lint` passes src/ and e2e/ explicitly, and the
// harness checks its own files in the same layer.
export default tseslint.config(
  { ignores: ["dist/", "node_modules/"] },
  js.configs.recommended,
  ...tseslint.configs.strict,
);
