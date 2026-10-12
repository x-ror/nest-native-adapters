# Contributing

## Development

```sh
pnpm install
pnpm run check
pnpm run test
pnpm run test:bun
pnpm run test:packed
pnpm run test:graphql
pnpm run dev
```

- `shared/` holds the router, request parsing and response code that both
  adapters bundle. It is internal source, not a separate npm package. The
  packages ship only `dist/`, so run `pnpm run build` before packing either
  adapter.
- `test:conformance` and `test:bun` run the same real Nest module on each
  native adapter and compare it with Nest/Express.
- `test:packed` installs both built tarballs into clean temporary Nest 10, 11
  and 12 projects on Node and Bun, and type-checks their public imports with
  `skipLibCheck: false`.
- `test:graphql` does the same for the Apollo driver's two supported stacks.
- `dev` watches the Node example; `vp run build` builds both example
  entrypoints. Run `bun dist/bun.js` for the Bun example. Both expose
  `/hello/world` on port 3000.
- Dependency versions live in `pnpm-workspace.yaml` catalogs. The pnpm version
  is pinned in `package.json`.
- Vite+ handles builds, watch, formatting, Oxlint, type checks, and Vitest.
  TypeScript 7 is used for the repository's own tooling; `@nestjs/swagger`
  12.0.2 declares TypeScript 5.5/6 peer support.

## Benchmarks

The benchmark exercises the same real Nest fixture over loopback for a native
adapter and the Nest/Express or Nest/Fastify reference:

```sh
pnpm bench          # NodeHttpAdapter on Node
pnpm bench:express  # Nest/Express on Node
pnpm bench:fastify  # Nest/Fastify on Node
pnpm bench:bun               # BunHttpAdapter on Bun, Node load generators
pnpm bench:bun-node-adapter  # NodeHttpAdapter on Bun, Node load generators
```

| Variable                 | Default          | Meaning                                      |
| ------------------------ | ---------------- | -------------------------------------------- |
| `BENCH_WORKLOAD`         | `json`           | `json`, `route`, `post`, `mixed` or `router` |
| `BENCH_RUNS`             | 3                | Number of runs                               |
| `BENCH_WARMUP_MS`        | 2000             | Warmup per run                               |
| `BENCH_DURATION_MS`      | 10000            | Measurement per run                          |
| `BENCH_CONCURRENCY`      | 32               | Total concurrent clients                     |
| `BENCH_CLIENT_PROCESSES` | 4                | Load-generator processes                     |
| `BENCH_ROUTE_COUNTS`     | `100,1000,10000` | Route-table sizes for the `router` workload  |

The workloads are a JSON GET, a parameterized route with repeated query
fields, a JSON POST, or a round-robin mix of all three. `router` generates
static routes and measures the last registered route for each route-table
size, with a fresh server process per size.

The server runs separately from the load-generator processes. Clients use
persistent HTTP connections and synchronize measurement start after warmup.
Output includes each run's request rate, failures, mean latency, and
approximate percentile upper bounds from a logarithmic histogram, plus mean
throughput and standard deviation across runs.

Run each mode on an otherwise idle machine and compare the same workload,
runtime version, and environment. The harness does not model remote clients,
uploads, static files, SSE, or reverse-proxy overhead. It gives a reproducible
local baseline. It is not a production load test and does not show a
performance advantage.

## Releasing

Both packages share one version, recorded in `CHANGELOG.md`.

1. Set the same `version` in `packages/platform-node/package.json` and
   `packages/platform-bun/package.json`, and move the changelog's
   Unreleased entries under that version.
2. Push a tag `v<version>`. The Release workflow builds, runs the full
   check, test, Bun and packed-consumer suites, checks that the tag matches
   both packages and that a license is set, then publishes both packages to
   npm with provenance using OIDC, without an npm token. For each npm package,
   configure a GitHub Actions trusted publisher: user `x-ror`, repository
   `nest-native-adapters`, workflow filename `release.yml`, environment `npm`,
   and permission to run `npm publish`. The workflow uses GitHub-hosted runners
   and npm CLI 11.19.0 (trusted publishing requires npm 11.5.1+).

Trusted publishers are configured in the settings of existing npm packages.
For a new package, bootstrap it through an authenticated manual publish before
configuring its trusted publisher. After a successful OIDC publish, revoke
unused publishing tokens and remove the `NPM_TOKEN` secret. Do not rerun an old
token-based release workflow to test OIDC; it uses the workflow from its tag.
