# Native Apollo driver

Experimental, private workspace package: **not published to npm**.
`NativeApolloDriver` integrates Nest 10 / `@nestjs/graphql` 12 /
`@nestjs/apollo` 12 / Apollo Server 4 with `NodeHttpAdapter` and
`BunHttpAdapter`, using Apollo's HTTP execution API instead of Express or
Fastify middleware. The HTTP adapters retain their native identities.

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
GraphQL multipart uploads, incremental delivery and Apollo 5 / Nest 12 have
not been validated. Apollo 4 is end-of-life; this integration exists to test
existing applications, not to recommend Apollo 4 for new production projects.

`pnpm run test:graphql` builds and installs real tarballs into an isolated
Nest 10 consumer, checks declarations with `skipLibCheck: false`, and compares
Node/Bun responses with Express for queries, mutations, authorization errors,
GET, CSRF, CORS, contexts, a global prefix and application shutdown. It also
checks Nest-discovered plugins with injected dependencies, plugin rejection
status/errors, overlapping requests with distinct authentication/context
values, and completion of plugin request and server lifecycles.
Strict declaration checking of the upstream Nest GraphQL/Apollo packages also
needs their optional type dependencies: `ts-morph`, `@apollo/gateway` and
`@types/ws`. The isolated consumer installs them for type checking only;
gateway functionality is not covered.
It checks declarations with the existing application's TypeScript 5.2 /
CommonJS resolution settings: this older upstream Apollo release has
incompatible declarations under NodeNext. The native packages themselves are
ESM; applications must load them through an ESM-compatible bootstrap rather
than emitting `require("nestjs-adapter-apollo")`.
