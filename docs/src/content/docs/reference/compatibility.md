---
title: Compatibility
description: Supported runtimes, Nest versions and features of both adapters.
---

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
