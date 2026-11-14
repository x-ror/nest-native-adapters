import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: "https://x-ror.github.io",
  // CI overrides the base for pull request previews.
  base: process.env.DOCS_BASE || "/nest-native-adapters",
  integrations: [
    starlight({
      title: "nest-native-adapters",
      description: "NestJS HTTP adapters for node:http and Bun.serve, without Express or Fastify.",
      social: [
        { icon: "github", label: "GitHub", href: "https://github.com/x-ror/nest-native-adapters" },
      ],
      editLink: {
        baseUrl: "https://github.com/x-ror/nest-native-adapters/edit/main/site/",
      },
      sidebar: [
        {
          label: "Getting started",
          items: [
            { slug: "getting-started" },
            { slug: "migration" },
            { slug: "reference/compatibility" },
          ],
        },
        {
          label: "Nest adapter",
          items: [
            "guides/validation-and-scope",
            "guides/routing",
            "guides/responses",
            "guides/request-bodies",
            "guides/uploads",
            "guides/cors",
            "guides/cookies",
            "guides/static-files",
            "guides/trusted-proxies",
            "guides/tls",
            "guides/websockets",
            "guides/shutdown",
          ],
        },
        {
          label: "Integrations",
          items: ["guides/swagger", "guides/graphql"],
        },
        {
          label: "Reference",
          items: ["reference/deviations"],
        },
      ],
    }),
  ],
});
