import createConfig from "@hardlydifficult/ts-config/eslint";

const config = createConfig(import.meta.dirname + "/..");

// Add ignores for generated/temporary files
export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/coverage/**",
      "**/.turbo/**",
      "**/.tmp/**",
      "**/files/.claude/**",
      "**/storybook-static/**",
      "**/*.stories.tsx",
      "**/scripts/capture-screenshots.js",
    ],
  },
  ...config,
];
