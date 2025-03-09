export default {
  testEnvironment: "node",
  roots: ["<rootDir>/tests/jest"],
  testMatch: ["**/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
};
