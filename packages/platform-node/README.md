# nestjs-adapter-node

A [NestJS](https://nestjs.com) HTTP adapter built on `node:http`. It runs Nest on Node.js without Express or Fastify.

```sh
npm install nestjs-adapter-node
```

```ts
import { NestFactory } from "@nestjs/core";
import { NodeHttpAdapter } from "nestjs-adapter-node";
import { AppModule } from "./app.module.js";

const app = await NestFactory.create(AppModule, new NodeHttpAdapter());
await app.listen(3000);
```

Routing, middleware, guards, pipes, interceptors and exception filters are
Nest's own. CORS, cookies, trusted proxies, static files, body parsers,
`@Sse()`, uploads, versioning and views behave like Nest's Express adapter.

Requires Node.js 22+ and NestJS 10 (`@nestjs/common` 10.1.3+, `@nestjs/core`
10.2.8+), 11.0.0+ or 12.1.2+. See the
[repository README](https://github.com/x-ror/nest-native-adapters#readme) for
the compatibility matrix, migration notes from Express, and known deviations.
