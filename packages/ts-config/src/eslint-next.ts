import type { Linter } from "eslint";

import createConfig from "./eslint.js";

export default function createNextConfig(
  projectRoot: string,
  nextConfig: Linter.Config[]
) {
  return [
    ...nextConfig,
    ...createConfig(projectRoot),
    {
      rules: {
        // React-specific rules
        "react/react-in-jsx-scope": "off",
        "react/prop-types": "off",
        "react/self-closing-comp": [
          "error",
          {
            component: true,
            html: true,
          },
        ],
        "react/jsx-boolean-value": ["error", "never"],
        "react/no-array-index-key": "warn",
        "react/jsx-curly-brace-presence": [
          "error",
          { props: "never", children: "never" },
        ],
      },
    },
  ];
}
