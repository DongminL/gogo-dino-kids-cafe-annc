/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "jsdom",
  testPathIgnorePatterns: ["/node_modules/", "/e2e/"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "./tsconfig.test.json" }],
    "^.+\\.js$": ["ts-jest", { tsconfig: "./tsconfig.test.json", diagnostics: false }],
  },
  transformIgnorePatterns: [
    "/node_modules/(?!@hyunbinseo/holidays-kr/)",
  ],
  moduleNameMapper: {
    "^@/.*\\.module\\.(css|scss)$": "<rootDir>/src/__mocks__/cssModuleMock.ts",
    "^@/(.*)$": "<rootDir>/src/$1",
    "\\.module\\.(css|scss)$": "<rootDir>/src/__mocks__/cssModuleMock.ts",
  },
  setupFilesAfterEnv: ["<rootDir>/src/setupTests.ts"],
};
