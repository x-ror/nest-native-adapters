---
title: Request bodies
description: JSON, URL-encoded, text and raw bodies, limits and signed webhooks.
---

The adapters parse JSON, nested URL-encoded and multipart form bodies by
default. Repeated form fields become arrays, and bracket notation creates
nested objects and arrays.

Packed consumers cover nested URL-encoded DTO transformation and validation,
indexed arrays, repeated fields, Unicode, invalid form paths, exact byte-limit
boundaries and concurrent requests on Nest 10/11/12 and Node/Bun. Use
`@Type(() => ChildDto)` with `@ValidateNested({ each: true })` for arrays of
child DTOs; numeric fields also need explicit transformation metadata.

Text, raw and extra JSON/URL-encoded media types are opt-in:
`app.useBodyParser("text")`, `app.useBodyParser("raw", { limit: "1mb" })` or
`app.useBodyParser("json", { type: "application/vnd.api+json" })`. `type` takes
exact media types, `text/*`-style prefixes or `*/*`.

The parsed-body limit defaults to 100 KiB. Raise it with
`new NodeHttpAdapter({ bodyLimit: 1024 * 1024 })`, or the same option on
`BunHttpAdapter`. Limits count bytes, not characters, and the adapter applies
them before it calls the controller.

## Signed webhooks

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
require `app.useBodyParser("raw")`.

`bodyParser: false` disables automatic parser registration, not explicitly
registered parsers. Without a matching parser, `request.body` stays undefined
and `request.raw` remains readable. For manual registration across Nest
10/11/12, use the adapter directly:

```ts
const adapter = new NodeHttpAdapter();
const app = await NestFactory.create(AppModule, adapter, {
  bodyParser: false,
});
adapter.useBodyParser("json", true, {
  type: "application/vnd.webhook+json",
  limit: 1024 * 1024,
});
```

The second adapter argument enables `rawBody` for that parser. Unlike Nest's
application-level `app.useBodyParser()` facade, it takes this boolean
explicitly. Register parsers before initializing or listening. Packed
consumers cover this mode with JSON, text and binary parsers, limits, errors
and concurrent requests on Node/Bun.
