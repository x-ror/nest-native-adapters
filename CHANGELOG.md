# Changelog

Both packages, `nestjs-adapter-node` and `nestjs-adapter-bun`, share one
version and one changelog. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Packed Nest WebSocket gateway coverage on Nest 10/11/12 for Node's
  `WsAdapter` and Bun's `BunWsAdapter`: concurrent clients, malformed and
  unknown messages, and HTTP routing on the shared port.

- Packed host-routing coverage on Nest 10/11/12 and Node/Bun: exact and
  parameterized hosts, host arrays, fallback controllers, proxy trust,
  global prefixes and concurrent tenant isolation. Real HTTP consumers also
  verify trusted/untrusted `X-Forwarded-*`, `ip`/`ips`, protocol, host,
  hostname, secure and subdomain metadata.

- Packed URI versioning coverage on Nest 10/11/12 and Node/Bun: controller/
  handler overrides, multiple versions, neutral/default versions, custom/
  disabled URI prefixes, middleware invocation and rejection of route aliases.

- Packed response-contract coverage on Nest 10/11/12 and Node/Bun:
  asynchronous manual/passthrough responses, class serialization with excluded
  fields, cookies/headers, HTTP 204, dynamic redirects and exception content types.

- Packed middleware/global-prefix exclusion coverage on Nest 10/11/12 and
  Node/Bun: method-specific and parameterized paths, all-method exclusions,
  query strings, middleware ordering and absence of unintended route aliases.

- Packed disk-upload cleanup coverage for guard/validator rejection, handler
  errors, malformed multipart, size/count limits and mixed concurrent requests
  on Nest 10/11/12 and Node/Bun.

- Packed shutdown coverage on Nest 10/11/12 and Node/Bun: asynchronous
  lifecycle hook order, graceful in-flight responses, SSE producer cleanup
  on timeout/forced close and refusal of connections after `app.close()`.

- Packed SSE coverage on Nest 10/11/12 and Node/Bun for event IDs/types,
  retry values, multiline data, concurrent streams, `Last-Event-ID` headers
  and Observable cleanup after client cancellation.

- Signed webhook coverage on Nest 10/11/12 and Node/Bun: exact `rawBody`
  bytes for JSON, custom content types, binary and chunked UTF-8; signature
  rejection, byte-counted body limits, parser-error recovery and concurrency.

- Packed HTTP coverage for request-scoped DI and scope bubbling on Nest
  10/11/12, sharing one provider across middleware, guards, interceptors,
  filters and controllers while isolating sequential and concurrent requests.

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

- Truncated disk multipart uploads return HTTP 400 instead of misclassifying
  parser errors propagated through file streams as disk write failures (500).
  Real disk write errors retain their original error classification.

- Legacy Nest SSE streams no longer terminate immediately because the raw
  web `Request` lacks Node's `on("close")`. A close-event bridge maps client
  aborts to subscription cleanup while preserving the web request API.
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
