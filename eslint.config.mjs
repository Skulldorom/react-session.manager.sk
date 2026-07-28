import js from "@eslint/js";
import eslintReact from "@eslint-react/eslint-plugin";
import prettierConfig from "eslint-config-prettier";

const browserGlobals = {
  caches: "readonly",
  clearInterval: "readonly",
  clearTimeout: "readonly",
  console: "readonly",
  document: "readonly",
  localStorage: "readonly",
  sessionStorage: "readonly",
  setInterval: "readonly",
  setTimeout: "readonly",
  window: "readonly",
};

export default [
  js.configs.recommended,
  {
    ...eslintReact.configs.recommended,
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: browserGlobals,
    },
    rules: {
      ...eslintReact.configs.recommended.rules,
      "no-console": "off",
    },
  },
  prettierConfig,
];
