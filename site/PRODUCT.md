# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

NestJS developers who already run an application on Nest's Express or Fastify
platform and are evaluating whether to switch to a native adapter. They arrive
to check compatibility, follow the migration, and look up how a specific
feature (routing, CORS, uploads, SSE, WebSockets) behaves and where it deviates
from Express.

## Product Purpose

`nestjs-adapter-node` (`NodeHttpAdapter`, on `node:http`) and
`nestjs-adapter-bun` (`BunHttpAdapter`, on `Bun.serve`) replace only Nest's
HTTP platform. Modules, DI, decorators, guards, pipes, interceptors, filters
and lifecycle remain Nest's own. The documentation site succeeds when a Nest
developer can decide, migrate and look up behavior without reading the source.

## Positioning

Express-compatible behavior without Express or Fastify: the adapters aim to
behave like Nest's Express adapter, verified by tests on NestJS 10, 11 and 12
on both Node.js and Bun, with documented deviations.

Performance is a point the owner wants to make, but no benchmark results are
published. The repository ships a reproducible benchmark harness
(`pnpm bench`, `bench:express`, `bench:fastify`, `bench:bun`), and
CONTRIBUTING.md states it "does not show a performance advantage". The site
must not claim speed advantages or show numbers until real results are
published.

## Operating Context

Read alongside an existing Nest codebase: copy-paste install and bootstrap
code, compare with Express behavior, check the compatibility matrix and
deviations list. Deployed to GitHub Pages at
https://x-ror.github.io/nest-native-adapters/ with PR previews.

## Capabilities and Constraints

- Node.js 22+ or Bun 1.4+; NestJS 10 (`@nestjs/common` 10.1.3+,
  `@nestjs/core` 10.2.8+), 11.0.0+, 12.1.2+.
- ESM-only packages. Status: experimental.
- Site stack: Astro + Starlight, kept for navigation, search (Pagefind) and
  content structure; design changes are a custom Starlight theme.
- License 0BSD.

## Brand Commitments

Project name `nest-native-adapters`. Existing favicon: "NA" on Nest red
`#e0234e`. No logo or other brand assets.

## Evidence on Hand

- Compatibility matrix and deviations list (site/src/content/docs/reference/).
- Test coverage across Nest 10/11/12 and Node/Bun (CHANGELOG.md).
- No benchmark results, testimonials, users or adoption figures: do not
  fabricate any.

## Product Principles

1. Truth over pitch: every claim maps to a test, a matrix entry or a documented deviation.
2. Migration first: the Express user's path (install, swap adapter, check deviations) is the shortest path on the site.
3. Reference speed: code, tables and behavior notes must be fast to scan and copy.
