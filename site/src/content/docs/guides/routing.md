---
title: Routing
description: Route syntax, host-based controllers, versioning and exclusions.
---

Routes use `path-to-regexp` 8 syntax with named parameters and wildcards.
Route matching is case-sensitive. Repeated query-string keys become arrays.

## Host-based controllers

Host-based controllers (`@Controller({ host: ":tenant.example.test" })`) and
`@HostParam("tenant")` follow Nest's host filtering. When several controllers
share a route, register specific hosts before broader patterns and before
controllers without a host. Hostnames exclude the port. Forwarded host headers
affect routing only when the adapter's `trustProxy` policy trusts the
connection. Host routing only selects a controller. It does not authorize
access to a tenant.

## Versioning

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

## Middleware and global-prefix exclusions

Middleware exclusions and global-prefix exclusions are separate.
`consumer.apply(...).exclude(...).forRoutes(...)` skips only that middleware.
`app.setGlobalPrefix("api", { exclude: [...] })` leaves matching routes
unprefixed. An exclusion with `RequestMethod.GET` does not also exclude POST
on the same path. Use unprefixed paths in both configurations. For example,
excluding GET `health` from the global prefix serves GET `/health`, while POST
remains at `/api/health`.

With URI versioning, excluding a route removes only the global prefix, not
its version segment: excluding GET `prefix/item/:id` serves
`/v1/prefix/item/42`, while POST remains at `/api/v1/prefix/item/42`.
An excluded `VERSION_NEUTRAL` route has neither prefix nor version segment.
Controller middleware still runs on excluded routes. Packed consumers cover
parameterized and wildcard exclusions, multiple versions, `prefix: false`,
`@All()` HTTP methods and concurrent requests on Nest 10/11/12 and Node/Bun.
Legacy controller wildcards such as `open/*` are normalized by the adapters
even when older Nest cores do not call `normalizePath()` during registration.
