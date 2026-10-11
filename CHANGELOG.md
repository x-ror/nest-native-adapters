# Changelog

Both packages, `nestjs-adapter-node` and `nestjs-adapter-bun`, share one
version and one changelog. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Nest 11 HTTP adapter support, with strict packed consumers on Nest 11.0.0
  and 11.2.7 for both Node and Bun. The Nest 10/11/12 matrix now also covers
  DTO validation, guards/filters, prefixes, parameters, header versioning,
  streamed responses, HEAD and CORS.

- Private experimental `nestjs-adapter-apollo` workspace package: native
  Apollo 4 / Nest 10 and Apollo 5 / Nest 12 HTTP driver on Node and Bun, with request-isolated
  contexts and no Express/Fastify identity spoofing.
- Packed GraphQL consumer checks and CI coverage for queries, mutations,
  authorization errors, GET, CSRF, CORS, global prefixes and Apollo shutdown.
- GraphQL coverage for Nest-discovered injectable plugins, plugin rejection
  responses, concurrent request context isolation and plugin lifecycle cleanup.
- Packed GraphQL checks cover both supported dependency stacks, including
  strict TypeScript 6 / NodeNext declarations for Nest 12 / Apollo 5 and
  version-specific variable coercion HTTP statuses.

- Shared Node/Bun integration coverage for transformed and validated DTOs,
  guards, injected exception filters, asynchronous service errors, response
  interceptors, Swagger documents/UI assets, and memory/disk upload decorators.
- Nest 10 peer support and strict packed-consumer checks on Nest 10.1.3/common
  with 10.2.8/core and on Nest 12.1.2, using both Node and Bun.

### Fixed

- Request types expose optional upload interceptor fields and accurately type
  missing/array-valued headers and potentially absent hostnames.
- Upload interceptors reject invalid `maxCount` configuration.
- Packed-consumer checks validate declarations without `skipLibCheck`.
- Swagger response handlers no longer fail because `res.type()` was missing.
  `NativeResponse.type()` accepts full MIME types, not extension shorthands.
- Removed hard runtime imports of Nest 12-only internal route/cookie helpers;
  common legacy middleware wildcards and cookie-parser signing work on Nest 10.
- Buffered response completion reaches `response.raw` listeners, and requests
  expose an empty `baseUrl` for Express-style metrics middleware.

## [0.1.1] - 2026-10-11

### Changed

- Publish releases through npm Trusted Publishing (GitHub Actions OIDC)
  without a long-lived npm token, with provenance attestations.
- No adapter runtime or public API changes.

## [0.1.0] - 2026-10-11

First npm release. Supported baseline: NestJS 12.1.2, Node.js 22+, Bun 1.4+.

### Added

- `NodeHttpAdapter` (`node:http`) and `BunHttpAdapter` (`Bun.serve`) for real
  Nest: routing, middleware, guards, pipes, interceptors, filters and DI.
- JSON, URL-encoded and multipart bodies, opt-in text/raw parsers, raw bodies,
  `FileInterceptor` and friends with Multer's memory-storage file shape.
- Opt-in disk-backed streaming for multipart file parts via `uploadStorage`,
  with temporary files exposed through `DiskUploadedFileData` and removed
  after the response completes.
- Adapter-wide multipart per-file size (`uploadFileLimit`) and file-count
  (`uploadFilesLimit`) limits, enforced in memory and streaming modes.
- All Nest versioning types, native HTTPS via `httpsOptions`, `@Sse()`,
  `res.write()` streaming, `@Render()` with Express-compatible engines,
  WebSocket gateways (Node: Nest's adapters; Bun: `BunWsAdapter`).
- CORS with the `cors` package's options and headers.
- Nest's cookie API, Express-style `res.cookie()` / `res.clearCookie()`, and
  compatibility with `cookie-parser`.
- Express's `trust proxy` semantics through the `trustProxy` option or
  `app.set("trust proxy", …)`, with `req.ip`, `req.ips`, `req.protocol` and
  `req.hostname`.
- `useStaticAssets()` like `express.static()`: validators, `304`/`412`, byte
  ranges, `maxAge`, dotfiles, redirects and streamed files.
- Graceful `close()`, `shutdownTimeout`, `forceCloseConnections` and
  `return503OnClosing`.
- `req.secure`, `req.host` and `req.subdomains` as on Express, with the
  `subdomain offset` setting.
- Response events (`finish`, `close`) and native HTTPS on Bun too.

### Fixed (from pre-release builds)

- On Bun, a request with a missing or invalid Host header (for which Bun
  passes a bare `/path` URL) was routed with its first path segment cut off,
  so `/x/admin` reached `/admin`. Such requests now route by their own path.

### Changed (from pre-release builds)

- CORS follows the `cors` package: `origin: true` reflects the request origin,
  an `undefined` origin disables CORS, every `OPTIONS` request is a preflight
  unless `preflightContinue`, and `Vary` is appended. See the README's CORS
  section for the full list.
- `req.cookies` and `req.signedCookies` are left to `cookie-parser`, as on
  Express.
- Static `maxAge` is in milliseconds, as on Express (it was seconds).
