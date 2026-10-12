# nest-native-adapters

Experimental HTTP adapters that run NestJS on `node:http` (Node.js) and
`Bun.serve` (Bun) without Express or Fastify. They replace only the HTTP
platform. Nest still provides modules, DI, decorators, guards, pipes,
interceptors, exception filters and the application lifecycle.

## Packages

| Package               | Role                                     |
| --------------------- | ---------------------------------------- |
| `nestjs-adapter-node` | `NodeHttpAdapter`, backed by `node:http` |
| `nestjs-adapter-bun`  | `BunHttpAdapter`, backed by `Bun.serve`  |

The adapters support NestJS 10 (`@nestjs/common` 10.1.3+, `@nestjs/core` 10.2.8+),
11.0.0+ and 12.1.2+, on Node.js 22+ or Bun 1.4+.

## Compatibility matrix

| Capability                                           | Node adapter | Bun adapter   | Notes                                                                                      |
| ---------------------------------------------------- | ------------ | ------------- | ------------------------------------------------------------------------------------------ |
| Runtime                                              | Node.js 22+  | Bun 1.4+      | Bun uses `Bun.serve`                                                                       |
| Routing, middleware, guards, pipes, interceptors, DI | Supported    | Supported     | Including request-scoped providers                                                         |
| JSON and nested URL-encoded bodies                   | Supported    | Supported     | Parsed body limit defaults to 100 KiB                                                      |
| Multipart forms                                      | Supported    | Supported     | Files are native `File` values on `@Body()` by default; opt-in disk streaming is available |
| CORS                                                 | Supported    | Supported     | Same options and headers as `cors` (Express)                                               |
| Trusted proxies (`X-Forwarded-*`)                    | Supported    | Supported     | Express's `trust proxy`: `ip`, `ips`, `protocol`, `hostname`                               |
| Cookies                                              | Supported    | Supported     | Nest's cookie API, `res.cookie()`, `cookie-parser`                                         |
| Static assets                                        | Supported    | Supported     | `express.static` options, validators and byte ranges                                       |
| Text, raw and custom-type bodies                     | Supported    | Supported     | Opt in with `app.useBodyParser(...)`                                                       |
| URI, header, media-type and custom versioning        | Supported    | Supported     | Same per-handler matching as Nest's Express adapter                                        |
| Nest `@Sse()`                                        | Supported    | Supported     | Observable `MessageEvent` stream                                                           |
| Streamed responses with `res.write()`                | Supported    | Supported     | Chunked; headers are sent on the first write                                               |
| Response events (`res.on("finish")`)                 | Supported    | Supported     | `finish` and `close`; Node forwards to `ServerResponse`                                    |
| TLS / HTTPS                                          | Supported    | Supported     | Nest `httpsOptions`; Bun reads key, cert, ca and passphrase                                |
| WebSocket gateways                                   | Supported    | Supported     | Node: Nest's `WsAdapter`; Bun: `BunWsAdapter`                                              |
| Socket.IO gateways                                   | Supported    | Not supported | Automatic on Node; under Bun use the Node adapter                                          |
| File upload interceptors                             | Supported    | Supported     | Memory storage by default; opt-in temporary disk streaming                                 |
| MVC (`@Render()`)                                    | Supported    | Supported     | Express-compatible engines (`ejs`, `pug`, `hbs`)                                           |
| Swagger documents and UI                             | Supported    | Supported     | `@nestjs/swagger` 12 on Nest 12, 7 on Nest 10                                              |

## Usage

```sh
npm install nestjs-adapter-node   # or nestjs-adapter-bun
```

```ts
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { NodeHttpAdapter } from "nestjs-adapter-node";
import { AppModule } from "./app.js";

const app = await NestFactory.create(AppModule, new NodeHttpAdapter());
await app.listen(3000);
```

For Bun, replace `NodeHttpAdapter` with `BunHttpAdapter` from
`nestjs-adapter-bun` and run the application with Bun.

The packages are ESM-only. TypeScript consumers need `@types/node`, and
consumers that import the Bun adapter also need `@types/bun`.

Express plugins do not work with these adapters. `@Req()` gives you a
`NativeRequest` with `.raw` (a web `Request`) and Nest's usual data fields.
`@Res()` gives you a `NativeResponse` with `status`, `json`, `send`, `write`,
`end`, `setHeader`, `getHeader` and `redirect`. It is not a Node
`ServerResponse`. An unsupported adapter option throws an error instead of
being ignored.

`NativeRequest.headers` has Node's `IncomingHttpHeaders` type, so a header may
be a string, an array, or absent. `hostname` can be absent too. Upload
interceptors populate the optional `file` and `files` fields.

### Migrating from Express or Fastify

Controllers and providers that do not touch the request or response objects
need no changes. Check the code that does:

- Change adapter construction to `new NodeHttpAdapter()` or
  `new BunHttpAdapter()`. Do not install Express/Fastify platform plugins.
- Treat `@Req()` as `NativeRequest`. Its `.raw` is a Web `Request`, not an
  Express `Request`, Fastify request, or Node `IncomingMessage`. On Node the
  adapter builds `.raw` on first access, so read it only when you need it.
- Treat `@Res()` as `NativeResponse`. `res.status(...).json(...)`,
  `res.setHeader(...)`, `res.write(...)` and `res.on("finish" | "close")`
  are available. On Node, `res.on(...)` forwards to the underlying response.
  `req.ip`, `req.ips`, `req.protocol`, `req.secure`, `req.host`,
  `req.hostname` and `req.subdomains` behave as on Express. Other
  Express/Fastify APIs and plugin-specific methods are not available.
- Keep `@UploadedFile()` / `@UploadedFiles()` and import `FileInterceptor`,
  `FilesInterceptor`, `FileFieldsInterceptor` or `AnyFilesInterceptor` from the
  adapter package instead of `@nestjs/platform-express`. Callback-style
  `fileFilter` and per-interceptor limits require opt-in interceptor parsing.
  See Uploads.
- Keep `app.enableCors(...)` as is. The options and resulting headers match
  the `cors` package.
- Keep `cookie-parser` if middleware or guards read `req.cookies`.
  `res.cookie()` and `res.clearCookie()` behave as on Express. Nest's
  `@Cookies()` and `@SignedCookies()` need no middleware.
- Keep `app.useStaticAssets(root, options)`. It takes `express.static()`
  options, including `maxAge` in milliseconds.
- Pass Nest `httpsOptions` for native HTTPS, or terminate TLS at a reverse
  proxy. Keep `app.set("trust proxy", ...)` as is, or pass the same value as
  the `trustProxy` adapter option.
- Pass full MIME strings such as `application/json` to `res.type()`. It
  rejects Express extension shorthands such as `"json"`.

If the application depends on Multer disk storage, Fastify plugins or
Express-specific middleware, keep its existing platform adapter.
[DEVIATIONS.md](DEVIATIONS.md) lists the remaining differences from Express.

The request is not an `IncomingMessage` and has no `request.destroyed` flag.
Middleware that skips response headers based on that flag may behave
differently after a POST body has been read. `baseUrl` is always `""`.
Listeners on `response.raw` also receive the completion of a buffered response.

### Nest 10 applications

The adapters accept Nest 10 without upgrading the application to Nest 12.
Express and Fastify plugins used by an existing application still do not work.
Routes still use `path-to-regexp` 8 syntax. The adapters convert common legacy
middleware wildcards, but do not support legacy regular-expression routes.

Nest 10 does not provide Nest 12's `cookies` application option or
`@Cookies()` / `@SignedCookies()` decorators. Install `cookie-parser` to
populate `request.cookies`, `request.signedCookies` and the signing secret.
`res.cookie()` and `res.clearCookie()` work on every supported Nest version.
Nest 12 keeps using its built-in cookie serializer and application-level signer.

### Validation and request scope

Use Nest's `ValidationPipe` with `class-validator` and `class-transformer`
installed in the application. Compile DTO classes with
`experimentalDecorators: true` and `emitDecoratorMetadata: true`, and load
`reflect-metadata` before the application. Without emitted metadata, Nest
cannot infer the DTO type for global validation.

The adapters support Nest's request-scoped DI (`Scope.REQUEST` and the
`REQUEST` injection token). Middleware, guards, interceptors, filters and the
controller share one instance of a scoped provider within a request. Separate
requests get separate instances. Nest's scope bubbling applies. A controller
or provider that depends on a request-scoped provider becomes request-scoped
without an explicit scope.

### Swagger

`@nestjs/swagger` works with both adapters:

```ts
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

app.setGlobalPrefix("v1");
const document = SwaggerModule.createDocument(
  app,
  new DocumentBuilder().setTitle("My API").setVersion("1").build(),
);
SwaggerModule.setup("docs", app, document, { useGlobalPrefix: true });
```

This serves `/v1/docs/`, `/v1/docs-json`, and `/v1/docs-yaml`, including local
Swagger UI scripts and styles. Describe DTO properties with `@ApiProperty()`
and uploads with `@ApiConsumes("multipart/form-data")` / `@ApiBody()`.
The Swagger CLI plugin is untested.

### GraphQL

The standard Nest `ApolloDriver` only recognizes Express and Fastify and
rejects these adapters. The experimental workspace package `packages/apollo`
provides `NativeApolloDriver` for Nest 10 with Apollo 4 and Nest 12 with
Apollo 5. Its [README](packages/apollo/README.md) covers usage and
limitations. The package is not published to npm, and neither HTTP adapter
depends on it. It supports HTTP queries and mutations, but not subscriptions.

## Routing

Routes use `path-to-regexp` 8 syntax with named parameters and wildcards.
Route matching is case-sensitive. Repeated query-string keys become arrays.

### Host-based controllers

Host-based controllers (`@Controller({ host: ":tenant.example.test" })`) and
`@HostParam("tenant")` follow Nest's host filtering. When several controllers
share a route, register specific hosts before broader patterns and before
controllers without a host. Hostnames exclude the port. Forwarded host headers
affect routing only when the adapter's `trustProxy` policy trusts the
connection. Host routing only selects a controller. It does not authorize
access to a tenant.

### Versioning

The adapters support URI, header, media-type and custom versioning. With URI
versioning, `@Version()` overrides the controller's version, a handler can
accept several versions, and `VERSION_NEUTRAL` omits the version segment but
keeps the global prefix. `defaultVersion` applies to routes without explicit
version metadata. The URI prefix defaults to `v`. Change it with
`prefix: "release-"` or `prefix: false` in `app.enableVersioning()`.

Media-type versioning reads the configured parameter from `Accept` (for
example, `application/json; v=2`). A custom extractor can return a version
string or an array of acceptable versions. Matching follows handler
registration order, not the order of that array; it does not automatically
select the highest version. Register a `VERSION_NEUTRAL` fallback after
version-specific handlers if missing or unknown versions should be accepted.
Without a fallback, they return `404`. Packed consumers cover these cases,
global prefixes and concurrent version selection on Nest 10/11/12 and Node/Bun.

### Middleware and global-prefix exclusions

Middleware exclusions and global-prefix exclusions are separate.
`consumer.apply(...).exclude(...).forRoutes(...)` skips only that middleware.
`app.setGlobalPrefix("api", { exclude: [...] })` leaves matching routes
unprefixed. An exclusion with `RequestMethod.GET` does not also exclude POST
on the same path. Use unprefixed paths in both configurations. For example,
excluding GET `health` from the global prefix serves GET `/health`, while POST
remains at `/api/health`.

## Responses

Use `@Res({ passthrough: true })` when setting headers, cookies or a status
while returning a value for Nest to serialize. `ClassSerializerInterceptor`
still applies to returned class instances, including `@Exclude()` fields.
With plain `@Res()`, the handler must send the response itself with `json()`,
`send()` or `end()`. Nest does not send the returned value, and serialization
does not apply to data the handler sends.

Status, headers, cookies, redirects, HEAD and no-content responses and
`StreamableFile` work as they do on Nest's Express adapter.

`@Render()` works with Express-compatible view engines. Call
`app.setBaseViewsDir(dir)` (default `./views`) and `app.setViewEngine("ejs")`,
or pass `{ extension, render }` with any `(path, options, callback)` function.
Express `app.locals` and view caching settings are not available.
Install the engine in the application: it is resolved from the configured
view directories or application working directory, not bundled with the
adapter. `setBaseViewsDir()` also accepts an ordered array of directories.
Packed consumers cover real EJS escaping, asynchronous custom engines,
explicit template extensions, HEAD, concurrent template data and errors on
Nest 10/11/12 and Node/Bun. Missing templates and engine errors go through
Nest's exception handling.

### Response events and server handles

`NodeHttpAdapter#getHttpServer()` returns the Node `http.Server`. On Bun, the
server object that Nest sees is a small object with the events and address
that Nest's listen lifecycle needs. It is not a Node server. The Bun server is
at its `.native` property.

On Bun, `res.on("finish")` fires when the client has read the last chunk of a
streamed body. For a buffered or file body it fires when the adapter hands the
body to Bun, because Bun reports no later completion. `close` follows
`finish`. A stream that the client abandons emits only `close`. The response
supports the full EventEmitter listener API.

### Server-sent events

`@Sse()` streams Nest `MessageEvent` values as `text/event-stream`, including
event IDs, event types, retry values and multiline data:

```ts
import { Controller, Sse } from "@nestjs/common";
import { interval, map, take } from "rxjs";

@Controller()
export class EventsController {
  @Sse("events")
  events() {
    return interval(1000).pipe(
      take(3),
      map((count) => ({ data: { count } })),
    );
  }
}
```

A client disconnect unsubscribes its Observable without closing other clients'
streams. `Last-Event-ID` is available through request headers. Application
code must implement replay and resume itself.

For SSE behind Nginx, keep response buffering disabled for the SSE location
and set `proxy_read_timeout` to match the expected idle interval. The adapter
sends `X-Accel-Buffering: no`, but the proxy's own configuration decides
whether it buffers.

## Request bodies

The adapters parse JSON, nested URL-encoded and multipart form bodies by
default. Repeated form fields become arrays, and bracket notation creates
nested objects and arrays.

Text, raw and extra JSON/URL-encoded media types are opt-in:
`app.useBodyParser("text")`, `app.useBodyParser("raw", { limit: "1mb" })` or
`app.useBodyParser("json", { type: "application/vnd.api+json" })`. `type` takes
exact media types, `text/*`-style prefixes or `*/*`.

The parsed-body limit defaults to 100 KiB. Raise it with
`new NodeHttpAdapter({ bodyLimit: 1024 * 1024 })`, or the same option on
`BunHttpAdapter`. Limits count bytes, not characters, and the adapter applies
them before it calls the controller.

### Signed webhooks

Pass `rawBody: true` to `NestFactory.create()` to keep the original payload
as a `Buffer` on `NativeRequest.rawBody`, while still parsing JSON into
`request.body`. Verify webhook signatures against that buffer, not
`JSON.stringify(request.body)`, because whitespace, line endings and Unicode
encoding are part of the signed bytes.

```ts
const app = await NestFactory.create(AppModule, new NodeHttpAdapter({ bodyLimit: 1024 * 1024 }), {
  rawBody: true,
});
```

The same option works with `BunHttpAdapter`. For a custom JSON content type,
register `app.useBodyParser("json", { type: "application/vnd.example+json" })`.
Nest forwards the application's `rawBody` option to the parser. Binary payloads
require `app.useBodyParser("raw")`. Keep body parsing enabled for these parsers.

### Uploads

By default the adapters hold multipart files in memory. Without an upload
interceptor, files are native `File` values on `@Body()`. With
`FileInterceptor`, `FilesInterceptor`, `FileFieldsInterceptor` or
`AnyFilesInterceptor` (imported from the adapter package), files reach
`@UploadedFile()` / `@UploadedFiles()` in Multer's memory-storage shape
(`originalname`, `mimetype`, `size`, `buffer`).

For large uploads, opt into temporary disk-backed streaming:

```ts
new NodeHttpAdapter({
  uploadLimit: 10 * 1024 * 1024,
  uploadFileLimit: 5 * 1024 * 1024,
  uploadFilesLimit: 4,
  uploadStorage: { directory: "/var/tmp/my-app-uploads" },
});
```

Use the same options with `BunHttpAdapter`. The configured directory must
already exist and be writable. The adapter parses multipart fields as usual
and exposes files through `@UploadedFile()` / `@UploadedFiles()` as
`DiskUploadedFileData` (`path`, `destination`, `filename`, and metadata, but
no `buffer`). It removes the temporary files after the response completes,
including when a guard or validator rejects the request or the handler throws.
Move or copy a file in the controller if it must persist.

- `uploadLimit` limits the complete multipart payload in both modes and
  defaults to `bodyLimit`. `uploadFileLimit` defaults to `uploadLimit`.
  `uploadFilesLimit` is unlimited when omitted.
- A request over a size or count limit gets `413`. Truncated multipart data
  gets `400`.
- In disk mode the adapter enforces limits while streaming. In memory mode it
  checks per-file limits after buffering at most `uploadLimit` bytes.
- Parsing happens before guards, so a rejected request can already have files
  on disk until its response completes.
- With Nest's `rawBody` option, uploads stay in memory so that `rawBody` can
  hold the complete request.

#### Per-interceptor streaming limits

Opt in to parsing multipart inside upload interceptors, after guards:

```ts
new NodeHttpAdapter({
  uploadParsing: "interceptor",
  uploadLimit: 10 * 1024 * 1024,
});

@Post("avatar")
@UseInterceptors(FileInterceptor("avatar", {
  limits: { fileSize: 256 * 1024, files: 1 },
}))
upload(@UploadedFile() file: UploadedFile) {
  return { size: file.size };
}
```

The same mode works on Bun and with optional `uploadStorage`. Both storage
modes enforce `limits.fileSize` (bytes per file) and `limits.files` (total file
count) during streaming, returning `413` without waiting for the complete
payload. Local limits cannot increase the adapter's global limits.
Values must be nonnegative safe integers; zero permits only empty files or
no files, respectively.

Options occupy the second argument of `FileInterceptor`,
`FileFieldsInterceptor` and `AnyFilesInterceptor`, and the third argument of
`FilesInterceptor(fieldName, maxCount, options)`. `maxCount` and unexpected-field
checks retain their existing behavior after parsing. These options are typed as
`UploadInterceptorOptions`; other Multer limits are not supported.

In this opt-in mode, multipart bodies and files are unavailable to middleware,
guards and interceptors running before the upload interceptor. Every route
that needs multipart `@Body()` must install an upload interceptor, even without
local limits. JSON and URL-encoded parsing are unchanged. The mode cannot be
combined with Nest's `rawBody: true` option and fails at startup if it is.
Using local limits in the default middleware-parsing mode throws an explicit
configuration error on multipart requests; it does not claim to enforce them
retroactively. The default mode and existing interceptor calls are unchanged.

#### Filtering uploads

All four upload interceptors accept a callback-style `fileFilter` in the same
options object. Like local streaming limits, this requires
`uploadParsing: "interceptor"`.

```ts
FileInterceptor("avatar", {
  fileFilter(request, file, callback) {
    callback(null, file.mimetype === "image/png");
  },
});
```

The filter runs before writing the file to disk or buffering its contents in
memory. `callback(null, true)` accepts it; `callback(null, false)` drains and
skips it. A skipped file is absent from `@UploadedFile()` / `@UploadedFiles()`.
Callback errors and thrown errors abort parsing, preserve Nest HTTP exceptions,
and clean up already accepted temporary files. A plain `Error` produces HTTP
500 through Nest's usual exception handling.

Filters may call back asynchronously, must call back with a boolean decision
on success, and should do so exactly once. The parser preserves file order
even when decisions finish out of order. Metadata (`UploadFileMetadata`)
includes `fieldname`, `originalname`, `encoding` and `mimetype`, not a buffer
or disk path. `request.body` contains fields received so far, so fields sent
after the file may not yet be available. `UploadFileFilter` is exported by
both packages.

Skipped files still count toward `limits.files` and the total payload limit;
their contents are not subject to the accepted-file size limit. MIME types
and names are supplied by the client: filtering them does not validate file
contents or guarantee their safety.

## CORS

Browser cross-origin access is off until you call `app.enableCors()`, as on
Express. `app.enableCors(options)` and `NestFactory.create(..., { cors })` take
Nest's `CorsOptions` or a `CorsOptionsDelegate` and behave like the `cors`
package that Nest's Express adapter installs.

- The adapters merge options over the `cors` defaults (any origin,
  `GET,HEAD,PUT,PATCH,POST,DELETE`, status `204`). An `origin` that is present
  but `undefined` overrides the default, so
  `{ origin: process.env.CORS_ORIGIN }` with the variable unset turns CORS off
  instead of allowing every origin. `enableCors()` reads static options once,
  so later changes to the object have no effect.
- `origin` may be `*`, `true` (reflect the request origin), a string, a
  `RegExp`, an array of those, or a callback. The callback also runs for
  requests without an `Origin` header and receives `undefined`. An error it
  passes becomes a 500 response, as on Express.
- `methods`, `allowedHeaders` (alias `headers`) and `exposedHeaders` take
  strings or arrays. An empty `methods` or `exposedHeaders` (`""` or `[]`) and
  `allowedHeaders: []` send no header. Without `allowedHeaders`, or with
  `allowedHeaders: ""` (unset, as in `cors`), the adapters reflect the
  requested headers and add `Access-Control-Request-Headers` to `Vary`.
- The adapters honor `credentials`, `maxAge`, `preflightContinue` and
  `optionsSuccessStatus`. They answer every `OPTIONS` request as a preflight
  unless `preflightContinue` is set. In that case the request reaches the
  `@Options()` route with the CORS headers already set.
- A delegate may call back with no options to get the defaults. Only
  delegates and origin callbacks run per request.

> **Warning:** `origin: true` reflects any origin. Combined with
> `credentials: true` (or its alias `allowCredentials: true`), any website can
> make credentialed requests and read the responses. Use an allowlist for
> credentialed APIs.

Differences from Express:

- A `204` preflight carries no `Content-Length` header, as RFC 9110 requires.
- `methods: undefined` sends no `Access-Control-Allow-Methods`, and
  `optionsSuccessStatus: undefined` falls back to `204`. The `cors` package
  fails the preflight with a 500 in both cases.
- `allowCredentials: true` works as an alias of `credentials: true`.

## Cookies

Nest's own cookie support works unchanged on both adapters: `@Cookies()`,
`@SignedCookies()`, `httpAdapter.setCookie()` / `clearCookie()` and the
`cookies: { secret }` application option. The decorators parse the `Cookie`
header themselves, so they need no middleware.

Like Express, the adapters do not fill `req.cookies` or `req.signedCookies`.
To use them in middleware and guards, install `cookie-parser` as on Express
with `app.use(cookieParser(secret))`. It works unchanged, including `j:` JSON
cookies and signed cookies. `@SignedCookies()` falls back to its result
when `cookies.secret` is not configured. Signatures use the same
`s:value.signature` format everywhere, so give both the same secret.

For `@Res()` handlers migrated from Express, `NativeResponse` offers
`res.cookie(name, value, options)` and `res.clearCookie(name, options)` with
Express semantics:

- Objects become `j:`-prefixed JSON, and other values are stringified.
- `maxAge` is in milliseconds and also sets `Expires`. `null` leaves it out.
  Nest's `httpAdapter.setCookie()` takes `maxAge` in seconds.
- `null` or `false` for `domain`, `expires`, `priority` and `sameSite` leaves
  the attribute out. `sameSite: true` means `Strict`. A falsy `path` sends an
  empty `Path=`, which browsers treat like Express's missing Path.
- `signed: true` uses the secret that `cookie-parser` set, as Express does,
  and otherwise `cookies.secret`.

Nest serializes the cookies, so an invalid name, value or attribute throws a
`TypeError`, and `sameSite: "none"` or `partitioned` requires `secure: true`.
Express's `encode` option is not supported and throws.

```ts
@Get("login")
login(@Res() res: NativeResponse) {
  res
    .cookie("session", token, { httpOnly: true, secure: true, maxAge: 86_400_000 })
    .cookie("theme", "dark")
    .json({ ok: true });
}

@Get("me")
me(@Cookies("theme") theme: string, @SignedCookies("uid") uid?: string) {
  return { theme, uid };
}
```

## Static files

Packed consumers cover static assets on Nest 10/11/12 and Node/Bun: cache
validators, HEAD, partial and unsatisfiable ranges, stale `If-Range`,
preconditions, directory redirects/indexes, hidden files, controller
fallthrough and concurrent range requests.

`app.useStaticAssets(root, options)` behaves like `express.static()`, which
Nest's Express adapter uses:

- `ETag` and `Last-Modified` validators. `If-None-Match` and
  `If-Modified-Since` get `304`. A failed `If-Match` or `If-Unmodified-Since`
  gets `412`.
- Single byte ranges get `206`, and unsatisfiable ones get `416`. Several
  ranges, a malformed header or a stale `If-Range` send the whole file, as in
  `send`.
- `Cache-Control: public, max-age=…` from `maxAge` in milliseconds or a
  duration such as `"1d"`, plus `immutable`.
- Dotfiles are hidden by default (`dotfiles: "allow" | "deny" | "ignore"`).
- A directory requested without its trailing slash gets a `301` redirect.
- `index`, `extensions`, `setHeaders`, `fallthrough`, `etag`, `lastModified`,
  `cacheControl` and `acceptRanges` work as in `express.static()`.
- The adapter matches `prefix` per path segment, case-insensitively, like an
  Express mount path. `/assets` serves `/assets/app.js` but not `/assetsapp.js`.

Content types come from a built-in table that matches Express for common web
files. The adapters send other extensions as `application/octet-stream`. They
stream files from disk without buffering them. On Bun, a full file sent in
response to a request with a `Range` header has no `Content-Length` when it is
larger than 1 MiB, because Bun would otherwise apply the range itself.

Point the root only at public assets. For high-volume delivery, use a CDN.

## Trusted proxies

By default the adapters ignore `X-Forwarded-*` headers, as Express does.
`req.ip`, `@Ip()`, `req.protocol` and `req.hostname` describe the direct
connection to the application. Behind a reverse proxy, tell the adapter which
hops to trust, with the same values as Express's `trust proxy` setting:

```ts
new NodeHttpAdapter({ trustProxy: "loopback" }); // or BunHttpAdapter
// or, as on Express, after creating the app:
app.set("trust proxy", 1);
```

| Value                       | Trusts                                                                    |
| --------------------------- | ------------------------------------------------------------------------- |
| `false` (default), `0`      | nothing                                                                   |
| `true`                      | every hop; only when nothing else can reach the app                       |
| a number `n`                | the nearest `n` hops                                                      |
| a string or array           | addresses, CIDR or netmask ranges, `loopback`, `linklocal`, `uniquelocal` |
| `(address, hop) => boolean` | whatever the function accepts; hop 0 is the socket peer                   |

With a trusted socket peer, `req.ip` becomes the nearest untrusted
`X-Forwarded-For` entry, `req.ips` lists the trusted chain farthest first,
`req.protocol` follows `X-Forwarded-Proto`, and `req.hostname` follows
`X-Forwarded-Host`. `req.host`, `req.secure` and `req.subdomains` use those
resolved values.

An invalid value, including a `/0` range, throws when you create the adapter
or apply the setting, so the app fails at startup as on Express. `null`,
`false` and `""` trust nothing.

`app.set()` accepts any setting, but only `trust proxy` and
`subdomain offset` have an effect. `x-powered-by` is accepted without a
warning, because these adapters never send that header. Any other setting
logs a warning that the adapter ignores it.

> **Warning:** trust only the proxies in front of the application. With
> `true` or a hop count larger than the real proxy chain, any client can set
> its own `req.ip` through `X-Forwarded-For`.

## TLS

The adapters serve HTTPS directly when you pass Nest `httpsOptions` (Bun
reads only `key`, `cert`, `ca` and `passphrase`). Otherwise terminate TLS at a
reverse proxy such as Nginx, and keep the application listener reachable only
from that proxy, for example by binding to `127.0.0.1` or a private container
network. Set the proxy's request-body limit to match the adapter's
`bodyLimit`, which defaults to 100 KiB.

Packed consumers verify direct HTTPS on Node and Bun for Nest 10/11/12 using
an isolated, short-lived self-signed localhost certificate. They also confirm
Nest request metadata reports `protocol: "https"` and `secure: true`.

Example Nginx configuration for an app listening on `127.0.0.1:3000`:

```nginx
server {
    listen 80;
    server_name example.com;
    return 301 https://example.com$request_uri;
}

server {
    listen 443 ssl;
    server_name example.com;

    ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;
    client_max_body_size 1m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

With the `1m` proxy limit, configure the adapter with
`{ bodyLimit: 1024 * 1024 }`.

## WebSockets

All WebSocket integrations need `@nestjs/websockets` installed in the application.

On Node the adapter's server is a Node `http.Server`, so Nest's own adapter
from `@nestjs/platform-ws` works unchanged:

```ts
import { WsAdapter } from "@nestjs/platform-ws";
app.useWebSocketAdapter(new WsAdapter(app));
```

On Bun use the bundled adapter, which runs on Bun's native WebSockets and
shares the HTTP port:

```ts
import { BunHttpAdapter, BunWsAdapter } from "nestjs-adapter-bun";
const app = await NestFactory.create(AppModule, new BunHttpAdapter());
app.useWebSocketAdapter(new BunWsAdapter(app));
```

`BunWsAdapter` uses the same `{ "event": ..., "data": ... }` JSON messages as
`WsAdapter`. It matches gateways by `@WebSocketGateway({ path })` and does not
support separate ports or namespaces. `@ConnectedSocket()` is Bun's
`ServerWebSocket`. Other integrations can share the Bun server through
`BunHttpAdapter#addSocketTransport`.

### Socket.IO

With `NodeHttpAdapter`, install `@nestjs/platform-socket.io` and nothing else.
Nest attaches Socket.IO to the adapter's `http.Server` itself, as it does with
Express. This also works when the application runs under Bun, so use
`NodeHttpAdapter` for Socket.IO on Bun.

`BunHttpAdapter` does not support Socket.IO or `@nestjs/platform-ws`, because
both need a Node HTTP server, which `Bun.serve` does not provide. Such an
application fails at startup with an error that names the cause.

## Shutdown

`app.close()` stops accepting connections and waits for in-flight requests to
finish. `shutdownTimeout` (default 5000 ms) limits that wait, and it also
applies to long-lived connections such as SSE. When it expires, the adapter
closes the remaining connections. Nest's `forceCloseConnections: true`
application option skips the wait. Closing an SSE connection unsubscribes its
Observable.

Nest runs `onModuleDestroy()` and `beforeApplicationShutdown()` before it
closes the HTTP adapter, and `onApplicationShutdown()` afterward. In-flight
handlers may still run during the first two hooks, so release the resources
they need in `onApplicationShutdown()`. `shutdownTimeout` limits HTTP draining
only, not the application's own asynchronous shutdown hooks.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development, benchmarks and releasing.
Changes are listed in [CHANGELOG.md](CHANGELOG.md).

## License

[0BSD](LICENSE). You may use, copy, modify and distribute the code for any
purpose, with or without attribution.
