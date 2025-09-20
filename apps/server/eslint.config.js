import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    ignores: ["dist"],
    rules: {
      "@typescript-eslint/explicit-module-boundary-types": "off"
    }
  }
);
