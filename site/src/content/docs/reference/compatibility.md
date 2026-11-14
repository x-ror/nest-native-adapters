---
title: Compatibility
description: Supported runtimes, Nest versions and features of both adapters.
---

| Capability                                           | Node adapter | Bun adapter   | Notes                                                                                      |
| ---------------------------------------------------- | ------------ | ------------- | ------------------------------------------------------------------------------------------ |
| Runtime                                              | Node.js 22+  | Bun 1.4+      | Bun uses `Bun.serve`                                                                       |
| Routing, middleware, guards, pipes, interceptors, DI | <span class="nna-mark nna-yes">Supported</span> | <span class="nna-mark nna-yes">Supported</span> | Including request-scoped providers                                                         |
| JSON and nested URL-encoded bodies                   | <span class="nna-mark nna-yes">Supported</span> | <span class="nna-mark nna-yes">Supported</span> | Parsed body limit defaults to 100 KiB                                                      |
| Multipart forms                                      | <span class="nna-mark nna-yes">Supported</span> | <span class="nna-mark nna-yes">Supported</span> | Files are native `File` values on `@Body()` by default; opt-in disk streaming is available |
| CORS                                                 | <span class="nna-mark nna-yes">Supported</span> | <span class="nna-mark nna-yes">Supported</span> | Same options and headers as `cors` (Express)                                               |
| Trusted proxies (`X-Forwarded-*`)                    | <span class="nna-mark nna-yes">Supported</span> | <span class="nna-mark nna-yes">Supported</span> | Express's `trust proxy`: `ip`, `ips`, `protocol`, `hostname`                               |
| Cookies                                              | <span class="nna-mark nna-yes">Supported</span> | <span class="nna-mark nna-yes">Supported</span> | Nest's cookie API, `res.cookie()`, `cookie-parser`                                         |
| Static assets                                        | <span class="nna-mark nna-yes">Supported</span> | <span class="nna-mark nna-yes">Supported</span> | `express.static` options, validators and byte ranges                                       |
| Text, raw and custom-type bodies                     | <span class="nna-mark nna-yes">Supported</span> | <span class="nna-mark nna-yes">Supported</span> | Opt in with `app.useBodyParser(...)`                                                       |
| URI, header, media-type and custom versioning        | <span class="nna-mark nna-yes">Supported</span> | <span class="nna-mark nna-yes">Supported</span> | Same per-handler matching as Nest's Express adapter                                        |
| Nest `@Sse()`                                        | <span class="nna-mark nna-yes">Supported</span> | <span class="nna-mark nna-yes">Supported</span> | Observable `MessageEvent` stream                                                           |
| Streamed responses with `res.write()`                | <span class="nna-mark nna-yes">Supported</span> | <span class="nna-mark nna-yes">Supported</span> | Chunked; headers are sent on the first write                                               |
| Response events (`res.on("finish")`)                 | <span class="nna-mark nna-yes">Supported</span> | <span class="nna-mark nna-yes">Supported</span> | `finish` and `close`; Node forwards to `ServerResponse`                                    |
| TLS / HTTPS                                          | <span class="nna-mark nna-yes">Supported</span> | <span class="nna-mark nna-yes">Supported</span> | Nest `httpsOptions`; Bun reads key, cert, ca and passphrase                                |
| WebSocket gateways                                   | <span class="nna-mark nna-yes">Supported</span> | <span class="nna-mark nna-yes">Supported</span> | Node: Nest's `WsAdapter`; Bun: `BunWsAdapter`                                              |
| Socket.IO gateways                                   | <span class="nna-mark nna-yes">Supported</span> | <span class="nna-mark nna-no">Not supported</span> | Automatic on Node; under Bun use the Node adapter                                          |
| File upload interceptors                             | <span class="nna-mark nna-yes">Supported</span> | <span class="nna-mark nna-yes">Supported</span> | Memory storage by default; opt-in temporary disk streaming                                 |
| MVC (`@Render()`)                                    | <span class="nna-mark nna-yes">Supported</span> | <span class="nna-mark nna-yes">Supported</span> | Express-compatible engines (`ejs`, `pug`, `hbs`)                                           |
| Swagger documents and UI                             | <span class="nna-mark nna-yes">Supported</span> | <span class="nna-mark nna-yes">Supported</span> | `@nestjs/swagger` 12 on Nest 12, 7 on Nest 10                                              |
