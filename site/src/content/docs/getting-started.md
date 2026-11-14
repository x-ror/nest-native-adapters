---
title: Getting started
description: Install an adapter and start a Nest application on it.
---

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
11.0.0+ and 12.1.2+, on Node.js 22+ or Bun 1.4+. See the
[compatibility matrix](../reference/compatibility/) for details.

## Installation

```sh
npm install nestjs-adapter-node   # or nestjs-adapter-bun
```

The packages are ESM-only. TypeScript consumers need `@types/node`, and
consumers that import the Bun adapter also need `@types/bun`.

## Usage

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

## Request and response objects

Express plugins do not work with these adapters. `@Req()` gives you a
`NativeRequest` with `.raw` (a web `Request`) and Nest's usual data fields.
`@Res()` gives you a `NativeResponse` with `status`, `json`, `send`, `write`,
`end`, `setHeader`, `getHeader` and `redirect`. It is not a Node
`ServerResponse`. An unsupported adapter option throws an error instead of
being ignored.

`NativeRequest.headers` has Node's `IncomingHttpHeaders` type, so a header may
be a string, an array, or absent. `hostname` can be absent too. Upload
interceptors populate the optional `file` and `files` fields.

Moving an existing application? Read
[Migrating from Express or Fastify](../migration/).
