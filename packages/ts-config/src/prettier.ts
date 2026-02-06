import { type Config } from "prettier";

const config: Config = {
  semi: true,
  singleQuote: false,
  tabWidth: 2,
  useTabs: false,
  trailingComma: "es5",
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: "always",
  endOfLine: "lf",
  printWidth: 80,
  quoteProps: "as-needed",
  jsxSingleQuote: false,
  proseWrap: "preserve",
  htmlWhitespaceSensitivity: "css",
  embeddedLanguageFormatting: "auto",
  singleAttributePerLine: false,
};

export default config;
