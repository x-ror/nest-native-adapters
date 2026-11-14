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
      favicon: "/favicon.svg",
      social: [
        { icon: "github", label: "GitHub", href: "https://github.com/x-ror/nest-native-adapters" },
      ],
      editLink: {
        baseUrl: "https://github.com/x-ror/nest-native-adapters/edit/main/site/",
      },
      customCss: [
        "@fontsource-variable/source-sans-3",
        "@fontsource-variable/jetbrains-mono",
        "@fontsource/barlow-semi-condensed/500.css",
        "@fontsource/barlow-semi-condensed/600.css",
        "@fontsource/barlow-semi-condensed/700.css",
        "./src/styles/theme.css",
      ],
      components: {
        PageTitle: "./src/components/PageTitle.astro",
        SiteTitle: "./src/components/SiteTitle.astro",
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
          label: "Guides",
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
