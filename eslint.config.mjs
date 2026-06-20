import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import stylistic from "@stylistic/eslint-plugin";

export default tseslint.config(
  { ignores: ["build/**", "dist/**", "node_modules/**", "playwright-report/**", "playwright-test-results/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}", "e2e/**/*.ts"],
    plugins: { "react-hooks": reactHooks, "@stylistic": stylistic },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // setState-in-effect 패턴은 여러 초기화 effect에서 구조적으로 사용됨 — 경고로 낮춤
      "react-hooks/set-state-in-effect": "warn",
      // ref 뮤테이션 패턴(generation 카운터 등)은 의도된 설계 — 경고로 낮춤
      "react-hooks/immutability": "warn",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" }],
      // const 재귀 화살표 함수(e.g. playAtIndex 자기 참조)의 정적 오탐 방지
      "@typescript-eslint/no-use-before-define": ["error", { functions: false, classes: false, variables: false }],
      "@stylistic/quotes": ["error", "double", { avoidEscape: true }],
      "no-restricted-imports": ["error", { patterns: [{ group: ["./*", "../*"], message: "@/ alias를 사용하세요." }] }],
    },
  },
);
