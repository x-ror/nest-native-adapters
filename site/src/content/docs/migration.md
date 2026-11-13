---
title: Migrating from Express or Fastify
description: What to change when moving an existing Nest application to the native adapters.
---

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
  See [Uploads](../guides/uploads/).
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
[Deviations from Express](../reference/deviations/) lists the remaining differences from Express.

The request is not an `IncomingMessage` and has no `request.destroyed` flag.
Middleware that skips response headers based on that flag may behave
differently after a POST body has been read. `baseUrl` is always `""`.
Listeners on `response.raw` also receive the completion of a buffered response.

## Nest 10 applications

The adapters accept Nest 10 without upgrading the application to Nest 12.
Express and Fastify plugins used by an existing application still do not work.
Routes still use `path-to-regexp` 8 syntax. The adapters convert common legacy
middleware wildcards, but do not support legacy regular-expression routes.

Nest 10 does not provide Nest 12's `cookies` application option or
`@Cookies()` / `@SignedCookies()` decorators. Install `cookie-parser` to
populate `request.cookies`, `request.signedCookies` and the signing secret.
`res.cookie()` and `res.clearCookie()` work on every supported Nest version.
Nest 12 keeps using its built-in cookie serializer and application-level signer.
