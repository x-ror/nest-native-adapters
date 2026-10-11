import { Readable } from "node:stream";
import { createRequire } from "node:module";
import type * as Apollo from "@apollo/server" with { "resolution-mode": "require" };
import { ApolloDriver, type ApolloDriverConfig } from "@nestjs/apollo";
import { Inject, Injectable, StreamableFile } from "@nestjs/common";
import { ModulesContainer } from "@nestjs/core";
import type { NativeRequest, NativeResponse } from "nestjs-adapter-node";

// Nest's Apollo 12 driver is CommonJS; use the same Apollo class and declaration branch.
const { ApolloServer, HeaderMap } = createRequire(import.meta.url)(
  "@apollo/server",
) as typeof Apollo;

/** Apollo 4 HTTP integration for native adapters on Nest 10. Subscriptions are not supported. */
@Injectable()
export class NativeApolloDriver extends ApolloDriver {
  constructor(@Inject(ModulesContainer) modules: ModulesContainer) {
    super(modules);
  }

  override async mergeDefaultOptions(options: ApolloDriverConfig): Promise<ApolloDriverConfig> {
    const context = options.context;
    // Nest 10's wrapper mutates object contexts with req; clone them per request.
    return super.mergeDefaultOptions(
      context && typeof context === "object"
        ? { ...options, context: () => ({ ...context }) }
        : options,
    );
  }

  override async start(options: ApolloDriverConfig): Promise<void> {
    if (options.subscriptions || options.installSubscriptionHandlers) {
      throw new Error("NativeApolloDriver supports HTTP operations only, not subscriptions.");
    }
    await super.start(options);
  }

  override async registerServer(options: ApolloDriverConfig): Promise<void> {
    const adapter = this.httpAdapterHost.httpAdapter;
    if (!["native-node", "native-bun"].includes(adapter.getType())) {
      throw new Error("NativeApolloDriver requires NodeHttpAdapter or BunHttpAdapter.");
    }
    if (!options.schema) throw new Error("NativeApolloDriver requires a generated GraphQL schema.");
    const server = new ApolloServer<Apollo.BaseContext>({
      ...options,
      schema: options.schema,
      typeDefs: undefined,
      resolvers: undefined,
    });
    await server.start();
    this.apolloServer = server;
    try {
      adapter.all(
        options.path ?? "/graphql",
        async (request: NativeRequest, response: NativeResponse) => {
          const headers = new HeaderMap();
          for (const [name, value] of Object.entries(request.headers)) {
            if (value !== undefined)
              headers.set(name, Array.isArray(value) ? value.join(", ") : value);
          }
          const queryIndex = request.originalUrl.indexOf("?");
          const result = await server.executeHTTPGraphQLRequest({
            httpGraphQLRequest: {
              method: request.method,
              headers,
              search: queryIndex === -1 ? "" : request.originalUrl.slice(queryIndex),
              body: request.body,
            },
            context: async () => {
              const context = await options.context({
                req: request,
                res: response,
                reply: response,
              });
              if (context === null || typeof context !== "object") {
                throw new TypeError("GraphQL context must return an object.");
              }
              // Both Express-style `res` and Fastify-style `reply` refer to the native response.
              return { ...context, req: context.req ?? request, res: response, reply: response };
            },
          });
          for (const [name, value] of result.headers) response.setHeader(name, value);
          response.status(result.status ?? 200);
          if (result.body.kind === "complete") {
            response.send(result.body.string);
          } else {
            response.send(new StreamableFile(Readable.from(result.body.asyncIterator)));
          }
        },
      );
    } catch (error) {
      await server.stop();
      throw error;
    }
  }
}
