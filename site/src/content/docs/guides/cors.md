---
title: CORS
description: CORS options and differences from the cors package.
---

Packed consumers cover asynchronous origin callbacks, credentials, reflected
preflight headers, `preflightContinue`, callback errors and concurrent
allowed/denied origins on Nest 10/11/12 and Node/Bun. Returning `false` from
the origin callback suppresses CORS headers but does not block the controller:
CORS is a browser policy, not server-side authorization.

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

:::caution
`origin: true` reflects any origin. Combined with
`credentials: true` (or its alias `allowCredentials: true`), any website can
make credentialed requests and read the responses. Use an allowlist for
credentialed APIs.
:::

<aside class="nna-deviation">
<p class="nna-deviation-title"><a href="../../reference/deviations/">Deviates from Express</a></p>

- A `204` preflight carries no `Content-Length` header, as RFC 9110 requires.
- `methods: undefined` sends no `Access-Control-Allow-Methods`, and
  `optionsSuccessStatus: undefined` falls back to `204`. The `cors` package
  fails the preflight with a 500 in both cases.
- `allowCredentials: true` works as an alias of `credentials: true`.

</aside>
