# Native Apollo driver

Experimental, private workspace package: **not published to npm**.
`NativeApolloDriver` integrates Apollo Server with `NodeHttpAdapter` and
`BunHttpAdapter`, using Apollo's HTTP execution API instead of Express or
Fastify middleware. The HTTP adapters retain their native identities.

Supported dependency combinations (do not mix rows):

| Nest | `@nestjs/graphql` / `@nestjs/apollo` | Apollo Server | GraphQL |
| ---- | ------------------------------------ | ------------- | ------- |
| 10   | 12                                   | 4.10+         | 16.8+   |
| 12   | 14.0.3+                              | 5.5.1+        | 16.11+  |

The workspace builds against Nest 12 / Apollo 5. Isolated packed consumers
cover both combinations on Node and Bun; Nest 11 and GraphQL 17 are not
currently supported.

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

Start Nest with either native HTTP adapter. Build and pack this workspace
package locally; the snippet does not imply that it is available on npm.
The Node adapter is a type peer of this package, including when running Bun.

Queries and mutations over HTTP, GET query parameters, Apollo's CSRF checks,
custom contexts, error formatting and Nest's discovered Apollo plugins are
supported. Enable CORS on the Nest application. Contexts expose `req`, `res`
and `reply`; both response names refer to the native response. Object contexts
are shallow-cloned per request, avoiding reuse of Nest 10's injected `req`.
Nested application state is not deep-cloned.

Apollo stops through Nest's GraphQL module lifecycle; the HTTP adapter owns
server draining. Do not add an Express/Fastify drain plugin. The endpoint is
an exact route, not an Express middleware mount accepting child paths.

Subscriptions are rejected at startup. WebSocket protocols, Apollo federation,
GraphQL multipart uploads and incremental delivery have not been validated.
Apollo 4 is end-of-life; its support exists for existing applications, not
as a recommendation for new production projects.

HTTP status semantics follow the installed Nest/Apollo combination, not a
cross-version normalization. For example, missing required variables return
HTTP 200 with Apollo 4's defaults but HTTP 400 with Apollo 5. Other inherited
options, including Nest Apollo 14's execution-error status handling, remain
controlled by the upstream driver.
On the modern stack, use `graphiql: true` to enable Nest's GraphiQL landing
page (`playground` is a deprecated alias). Code-first `autoSchemaFile`
generation is supported on both stacks.

`pnpm run test:graphql` builds and installs real tarballs into an isolated
consumer for each supported stack, checks declarations with `skipLibCheck: false`, and compares
Node/Bun responses with Express for queries, mutations, authorization errors,
GET, CSRF, CORS, contexts, a global prefix and application shutdown. It also
checks Nest-discovered plugins with injected dependencies, plugin rejection
status/errors, overlapping requests with distinct authentication/context
values, and completion of plugin request and server lifecycles.
Code-first schema generation is covered on both stacks; the modern stack
also covers the GraphiQL HTML response and both settings of
`preserveHttpStatusForExecutionErrors`.
Strict declaration checking of the upstream Nest GraphQL/Apollo packages also
needs their optional type dependencies: `ts-morph`, `@apollo/gateway` and
`@types/ws`. The isolated consumer installs them for type checking only;
gateway functionality is not covered.
The legacy stack checks declarations with the existing application's
TypeScript 5.2 / CommonJS resolution settings: the older upstream Apollo
release has incompatible declarations under NodeNext. The modern stack uses
TypeScript 6 / NodeNext. The native packages themselves are ESM; applications
must load them through an ESM-compatible bootstrap rather than emitting
`require("nestjs-adapter-apollo")`.
