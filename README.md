# nest-native-adapters

Run [NestJS](https://nestjs.com) on `node:http` (Node.js) or `Bun.serve` (Bun)
without Express or Fastify.

**📖 Documentation: <https://x-ror.github.io/nest-native-adapters/>**

| Package               | Adapter                                  |
| --------------------- | ---------------------------------------- |
| `nestjs-adapter-node` | `NodeHttpAdapter`, backed by `node:http` |
| `nestjs-adapter-bun`  | `BunHttpAdapter`, backed by `Bun.serve`  |

```sh
npm install nestjs-adapter-node   # or nestjs-adapter-bun
```

```ts
import { NestFactory } from "@nestjs/core";
import { NodeHttpAdapter } from "nestjs-adapter-node";
import { AppModule } from "./app.js";

const app = await NestFactory.create(AppModule, new NodeHttpAdapter());
await app.listen(3000);
```

Requires Node.js 22+ or Bun 1.4+ and NestJS 10, 11 or 12.

[Contributing](CONTRIBUTING.md) · [Changelog](CHANGELOG.md) · [License: 0BSD](LICENSE)
