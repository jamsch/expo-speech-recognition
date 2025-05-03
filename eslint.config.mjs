// @ts-check
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config([
  tseslint.configs.recommended,
  js.configs.recommended,
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    ignores: ["build/**"],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      "import/order": "off",
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "no-unused-vars": "off",
      "no-undef": "off",
    },
  },
]);
