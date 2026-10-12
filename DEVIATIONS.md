# Deviations from Nest's Express adapter

The adapters aim to behave like `@nestjs/platform-express`. These are the
known differences. The [README](README.md) has the usage details.

## Request and response objects

- `@Req()` and `@Res()` are `NativeRequest` and `NativeResponse`, the same
  fetch-compatible objects on Node and Bun. They are not Express or Fastify
  objects, and Express/Fastify plugins do not work.
- The request does not expose Express's `request.destroyed` flag, and
  `baseUrl` is always `""`.
- `res.type()` accepts full MIME types, not extension shorthands such as `"json"`.
- `res.vary()` skips empty entries where the `vary` package throws.
- Redirects always return a plain-text body, rather than Express's optional
  Accept-negotiated HTML redirect page.
- Of Express's `app.set()` settings, only `trust proxy` and `subdomain offset`
  have an effect.

## Bun

- `BunHttpAdapter` uses `Bun.serve`, not `node:http` running under Bun.
  The server object that Nest sees is not a Node server. The Bun server is
  at its `.native` property.
- For a buffered or file body, `res.on("finish")` fires when the adapter
  hands the body to Bun, not when Bun flushes it to the socket.
- Socket.IO and `@nestjs/platform-ws` need `NodeHttpAdapter`. `BunWsAdapter`
  does not support WebSocket namespaces or separate ports.

## Routing

- Routes use `path-to-regexp` 8 syntax. The adapters convert common legacy
  middleware wildcards, but do not support legacy regular-expression routes.

## Uploads

- Multer's `fileFilter` and per-interceptor options are not supported.
  `uploadFileLimit` and `uploadFilesLimit` apply adapter-wide.
- Without an upload interceptor, multipart files are native `File` values on
  `@Body()`.
- Disk storage is temporary. The adapter removes the files after the response.

## Static files

- Content types come from a built-in table of common web types. The adapters
  send other extensions as `application/octet-stream`.
- On Bun, a full response to a request with a `Range` header is sent without
  `Content-Length` above 1 MiB.

## CORS

- A `204` preflight omits `Content-Length`.
- `methods: undefined` and `optionsSuccessStatus: undefined` do not fail the
  preflight.
- `enableCors()` reads static options once.
- `allowCredentials` works as an alias of `credentials`.

## Cookies

- `res.cookie()` / `res.clearCookie()` can also sign with Nest's
  `cookies.secret`, not only with the `cookie-parser` secret.
- A falsy `path` sends an empty `Path=` instead of none.
- Nest's serializer rejects `sameSite: "none"` and `partitioned` without
  `secure`.
- The `encode` option throws.

## Not supported

- Deno.
- GraphQL subscriptions (see the [Apollo driver](packages/apollo/README.md)).
