import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightTypeDoc, {
  typeDocSidebarGroup,
} from "starlight-typedoc";

export default defineConfig({
  site: "https://hardlydifficult.github.io",
  base: "/typescript",
  integrations: [
    starlight({
      title: "@hardlydifficult",
      description:
        "Opinionated TypeScript libraries. One right way to do each thing.",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/HardlyDifficult/typescript",
        },
      ],
      plugins: [
        starlightTypeDoc({
          entryPoints: [
            "../../packages/ai-msg",
            "../../packages/chat",
            "../../packages/date-time",
            "../../packages/document-generator",
            "../../packages/github",
            "../../packages/logger",
            "../../packages/poller",
            "../../packages/state-tracker",
            "../../packages/task-list",
            "../../packages/text",
            "../../packages/throttle",
            "../../packages/workflow-engine",
          ],
          tsconfig: "../../tsconfig.base.json",
          output: "api",
          sidebar: {
            label: "API Reference",
            collapsed: false,
          },
          typeDoc: {
            entryPointStrategy: "packages",
            packageOptions: {
              entryPoints: ["src/index.ts"],
              readme: "README.md",
            },
            excludePrivate: true,
            excludeProtected: true,
            excludeInternal: true,
          },
        }),
      ],
      sidebar: [
        {
          label: "Overview",
          link: "/",
        },
        typeDocSidebarGroup,
      ],
    }),
  ],
});
