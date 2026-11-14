---
title: Responses
description: Passthrough responses, StreamableFile, views, response events and SSE.
---

Use `@Res({ passthrough: true })` when setting headers, cookies or a status
while returning a value for Nest to serialize. `ClassSerializerInterceptor`
still applies to returned class instances, including `@Exclude()` fields.
With plain `@Res()`, the handler must send the response itself with `json()`,
`send()` or `end()`. Nest does not send the returned value, and serialization
does not apply to data the handler sends.

Status, headers, cookies, redirects, HEAD and no-content responses and
`StreamableFile` work as they do on Nest's Express adapter.

HEAD preserves the corresponding GET's content length for buffered bodies
without sending the body. Responses with status `204` or `304` discard the
body and remove content type, content length and transfer encoding. Status
`205 Reset Content` discards the body, sets `Content-Length: 0` and removes
transfer encoding. Suppressed stream sources are destroyed without being read.

`StreamableFile` supplies content type, disposition and length only when those
headers have not already been set on the response. Buffers carry their length;
streams without a configured length are sent without `Content-Length`.
HEAD closes the source without reading it, and client disconnection destroys
an active source. A source error during transmission fails the download rather
than completing a truncated file; headers already sent cannot be replaced by
a Nest JSON error response.

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

## Response events and server handles

`NodeHttpAdapter#getHttpServer()` returns the Node `http.Server`. On Bun, the
server object that Nest sees is a small object with the events and address
that Nest's listen lifecycle needs. It is not a Node server. The Bun server is
at its `.native` property.

On Bun, `res.on("finish")` fires when the client has read the last chunk of a
streamed body. For a buffered or file body it fires when the adapter hands the
body to Bun, because Bun reports no later completion. `close` follows
`finish`. A stream that the client abandons emits only `close`. The response
supports the full EventEmitter listener API.

## Server-sent events

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
