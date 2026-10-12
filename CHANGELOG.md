# Changelog

Both packages, `nestjs-adapter-node` and `nestjs-adapter-bun`, share one
version and one changelog. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Packed global-prefix exclusion coverage with URI versioning on Nest 10/11/12
  and Node/Bun: method-specific and wildcard exclusions, neutral routes,
  controller middleware, `@All()` methods and concurrent requests.
- Packed `StreamableFile` coverage on Nest 10/11/12 and Node/Bun: buffer/stream
  metadata, explicit headers, HEAD source cleanup, client disconnection,
  transmission errors, recovery and concurrent downloads.
- Packed request-scoped global enhancer coverage on Nest 10/11/12 and Node/Bun:
  explicit `APP_*` scopes, shared `REQUEST` injection, parameter pipes, scope
  bubbling, concurrent request isolation and guard/pipe/handler error recovery.
- Packed WebSocket lifecycle coverage on Nest 10/11/12 and Node/Bun:
  separate gateway paths, connection/disconnection hooks and active-client
  shutdown through application lifecycle hooks.
- Packed manual parser coverage on Nest 10/11/12 and Node/Bun for
  `bodyParser: false`, unread native bodies, custom JSON/rawBody, text/raw
  parsers, limits, error recovery and concurrent requests.
- Packed DI-backed global enhancer coverage on Nest 10/11/12 and Node/Bun:
  `APP_*` registration via `useExisting`, parameter transformation, pipeline
  errors, `HttpAdapterHost` filters and concurrent requests.
- Packed dynamic CORS coverage on Nest 10/11/12 and Node/Bun: asynchronous
  origin callbacks, credentials, preflight continuation, errors and
  concurrent allowed/denied origins.
- Packed nested URL-encoded form coverage on Nest 10/11/12 and Node/Bun:
  DTO transformation/validation, arrays, Unicode, invalid paths, byte limits,
  parser-error recovery and concurrent requests.
- Packed MVC rendering coverage on Nest 10/11/12 and Node/Bun with EJS and
  asynchronous custom engines, view lookup, HEAD, rendering errors and
  concurrent template data.
- Packed static asset coverage across Nest 10/11/12 and Node/Bun for
  caching, HEAD, ranges, preconditions, directory indexes, controller
  fallthrough and concurrent requests.
- Packed media-type and custom versioning coverage on Nest 10/11/12 and
  Node/Bun: multiple accepted versions, neutral fallback, strict-route 404s,
  registration-order matching and concurrent requests.
- Callback-style `fileFilter` for all upload interceptors in interceptor
  parsing mode: accepts/skips before storage, supports delayed decisions,
  preserves file order and propagates errors with temporary-file cleanup.
- Opt-in `uploadParsing: "interceptor"` with streaming per-interceptor
  `limits.fileSize` and `limits.files` for all four upload interceptors on
  Node/Bun, in memory and on disk. Guards run before multipart parsing, and
  adapter-level limits remain upper bounds.
- Packed direct HTTPS checks across Nest 10/11/12 on Node/Bun, including
  `httpsOptions` and Nest `req.protocol` / `req.secure` metadata.
- Nest 11 support (11.0.0+).
- Nest 10 support (`@nestjs/common` 10.1.3+, `@nestjs/core` 10.2.8+).
- Experimental `nestjs-adapter-apollo` workspace package, not published to
  npm. It is an Apollo HTTP driver for both adapters, for Nest 10 with
  Apollo 4 and Nest 12 with Apollo 5.

### Fixed

- Legacy controller wildcard routes are normalized during HTTP route registration,
  preventing startup failures on older Nest cores that do not call the adapter's
  `normalizePath()`.
- `StreamableFile` no longer overwrites explicitly configured
  `Content-Disposition` and `Content-Length` response headers, matching Nest's
  Express adapter.
- Client disconnection cancels streaming multipart uploads and cleans temporary
  files even while an asynchronous `fileFilter` decision is pending. Late
  callbacks cannot resume storage after cancellation. Packed consumers cover
  interrupted memory/disk uploads on Nest 10/11/12 and Node/Bun.
- Truncated disk multipart uploads return HTTP 400 instead of 500.
- SSE streams on older Nest versions no longer terminate immediately.
- Request types include the optional upload interceptor fields, and allow
  missing or array-valued headers and an absent hostname.
- Upload interceptors reject invalid `maxCount` configuration.
- Swagger response handlers no longer fail because `res.type()` was missing.
  `NativeResponse.type()` accepts full MIME types, not extension shorthands.
- Common legacy middleware wildcards and `cookie-parser` signing work on
  Nest 10.
- Listeners on `response.raw` receive the completion of a buffered response,
  and requests have an empty `baseUrl` for Express-style metrics middleware.

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
