/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "jsdom",
  testPathIgnorePatterns: ["/node_modules/", "/e2e/"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "./tsconfig.test.json" }],
  },
  moduleNameMapper: {
    "^@/.*\\.module\\.(css|scss)$": "<rootDir>/src/__mocks__/cssModuleMock.ts",
    "^@/(.*)$": "<rootDir>/src/$1",
    "\\.module\\.(css|scss)$": "<rootDir>/src/__mocks__/cssModuleMock.ts",
  },
  setupFilesAfterEnv: ["<rootDir>/src/setupTests.ts"],
};
