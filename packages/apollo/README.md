# Native Apollo driver

An experimental workspace package. It is not published to npm.
`NativeApolloDriver` connects Apollo Server to `NodeHttpAdapter` and
`BunHttpAdapter` through Apollo's HTTP execution API, without Express or
Fastify middleware.

Supported dependency combinations (do not mix rows):

| Nest | `@nestjs/graphql` / `@nestjs/apollo` | Apollo Server | GraphQL |
| ---- | ------------------------------------ | ------------- | ------- |
| 10   | 12                                   | 4.10+         | 16.8+   |
| 12   | 14.0.3+                              | 5.5.1+        | 16.11+  |

Both combinations work on Node and Bun. Nest 11 and GraphQL 17 are not
supported.

```ts
import { GraphQLModule } from "@nestjs/graphql";
import type { ApolloDriverConfig } from "@nestjs/apollo";
import { NativeApolloDriver } from "nestjs-adapter-apollo";

GraphQLModule.forRoot<ApolloDriverConfig>({
  driver: NativeApolloDriver,
  autoSchemaFile: true,
  playground: false,
  context: ({ req, reply }) => ({ req, reply }),
});
```

Start Nest with either adapter. To use the driver, build and pack this
workspace package locally. `nestjs-adapter-node` is a peer dependency for its
types, also when you run on Bun.

The driver supports queries and mutations over HTTP, GET query parameters,
Apollo's CSRF checks, custom contexts, error formatting and the Apollo plugins
that Nest discovers. Enable CORS on the Nest application.

Contexts expose `req`, `res` and `reply`. `res` and `reply` are the same
native response. The driver shallow-clones an object context for each request,
so requests do not share Nest 10's injected `req`. It does not deep-clone
nested state.

Nest's GraphQL module stops Apollo, and the HTTP adapter drains the server.
Do not add an Express or Fastify drain plugin. The endpoint matches its exact
path only, not child paths.

The driver rejects subscriptions at startup. WebSocket protocols, Apollo
federation, GraphQL multipart uploads and incremental delivery are untested.
Apollo 4 is end-of-life. The driver supports it for existing applications, so
do not pick it for a new project.

HTTP status codes follow the installed Nest/Apollo combination and differ
between them. For example, a missing required variable returns HTTP 200 with
Apollo 4's defaults but HTTP 400 with Apollo 5. The upstream driver still
controls other inherited options, including Nest Apollo 14's execution-error
status handling.

On the Nest 12 stack, set `graphiql: true` to enable Nest's GraphiQL landing
page (`playground` is a deprecated alias). Code-first `autoSchemaFile`
generation works on both stacks.

Strict declaration checking (`skipLibCheck: false`) of the upstream Nest
GraphQL/Apollo packages needs their optional type dependencies `ts-morph`,
`@apollo/gateway` and `@types/ws`. On the Nest 10 stack, the upstream Apollo
declarations are incompatible with NodeNext resolution, so type-check with
CommonJS resolution settings there.

The package is ESM. Applications must load it through an ESM-compatible
bootstrap rather than emitting `require("nestjs-adapter-apollo")`.
