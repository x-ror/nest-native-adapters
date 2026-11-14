---
title: Static files
description: useStaticAssets with express.static() semantics.
---

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
