import "reflect-metadata";
import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";
import { Inject, Module, UnauthorizedException } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ApolloDriver, Plugin } from "@nestjs/apollo";
import { GraphQLModule } from "@nestjs/graphql";
import { GraphQLError } from "graphql";
import { ExpressAdapter } from "@nestjs/platform-express";
import { NativeApolloDriver } from "nestjs-adapter-apollo";
import { NodeHttpAdapter } from "nestjs-adapter-node";
import { BunHttpAdapter } from "nestjs-adapter-bun";

const mode = process.argv[2];
const reports = {};
for (const contextKind of mode === "express"
  ? ["function", "default"]
  : ["function", "object", "default"]) {
  let stopped = false;
  const pluginState = {
    started: 0,
    stopped: 0,
    completed: 0,
    active: new Set(),
    maxActive: 0,
  };
  class DiscoveredPlugin {
    constructor(state) {
      this.state = state;
    }
    async serverWillStart() {
      this.state.started++;
      return {
        serverWillStop: async () => {
          this.state.stopped++;
        },
      };
    }
    async requestDidStart({ contextValue }) {
      const { state } = this;
      assert.ok(!state.active.has(contextValue), "Requests must not share a context");
      state.active.add(contextValue);
      state.maxActive = Math.max(state.maxActive, state.active.size);
      return {
        async didResolveOperation() {
          contextValue.pluginRequestId = contextValue.req.headers["x-request-id"];
          if (contextValue.req.headers["x-block"] === "yes") {
            throw new GraphQLError("Fixture quota exceeded", {
              extensions: { code: "QUOTA_LIMIT_REACHED", http: { status: 429 } },
            });
          }
        },
        async willSendResponse() {
          assert.ok(state.active.delete(contextValue));
          state.completed++;
        },
      };
    }
  }
  Inject("plugin-state")(DiscoveredPlugin, undefined, 0);
  Plugin()(DiscoveredPlugin);
  const options = {
    driver: mode === "express" ? ApolloDriver : NativeApolloDriver,
    path: "/gql",
    useGlobalPrefix: true,
    playground: false,
    typeDefs: `
      type Query { hello(name: String!): String!, secured: String!, isolated: String! }
      type Mutation { add(a: Int!, b: Int!): Int! }
    `,
    resolvers: {
      Query: {
        hello: (_root, { name }, context) => {
          assert.ok(context.req);
          assert.equal(context.marker, contextKind === "default" ? undefined : "fixture");
          if (mode !== "express") {
            assert.equal(context.reply, context.res);
            context.reply.header("x-graphql-context", "native");
          }
          return `Hello ${name}`;
        },
        secured: (_root, _args, context) => {
          if (context.req.headers["x-auth"] !== "yes") throw new UnauthorizedException();
          return "authorized";
        },
        isolated: async (_root, _args, context) => {
          const requestId = context.req.headers["x-request-id"];
          const auth = context.req.headers["x-auth"];
          assert.equal(context.pluginRequestId, requestId);
          await setTimeout(20);
          assert.equal(context.req.headers["x-request-id"], requestId);
          assert.equal(context.req.headers["x-auth"], auth);
          assert.equal(context.pluginRequestId, requestId);
          return `${requestId}:${auth}`;
        },
      },
      Mutation: { add: (_root, { a, b }) => a + b },
    },
    plugins: [
      {
        async serverWillStart() {
          return {
            async serverWillStop() {
              stopped = true;
            },
          };
        },
      },
    ],
    formatError: ({ extensions, ...error }) => {
      const { stacktrace: _stacktrace, ...rest } = extensions;
      return { ...error, extensions: rest };
    },
    ...(contextKind === "function"
      ? { context: async ({ req }) => ({ req, marker: "fixture" }) }
      : contextKind === "object"
        ? { context: { marker: "fixture" } }
        : {}),
  };
  class TestModule {}
  Module({
    imports: [GraphQLModule.forRoot(options)],
    providers: [DiscoveredPlugin, { provide: "plugin-state", useValue: pluginState }],
  })(TestModule);
  const adapter =
    mode === "express"
      ? new ExpressAdapter()
      : mode === "node"
        ? new NodeHttpAdapter()
        : new BunHttpAdapter();
  const app = await NestFactory.create(TestModule, adapter, { logger: false, abortOnError: false });
  try {
    app.setGlobalPrefix("v1");
    app.enableCors();
    await app.listen(0, "127.0.0.1");
    const base = await app.getUrl();
    const json = async (query, extra = {}) => {
      const response = await fetch(`${base}/v1/gql`, {
        method: "POST",
        headers: { "content-type": "application/json", ...extra },
        body: JSON.stringify(query),
      });
      const body = await response.json();
      if (mode !== "express" && body.data?.hello) {
        assert.equal(response.headers.get("x-graphql-context"), "native");
      }
      return { status: response.status, body };
    };
    const result = [];
    const hello = await json({
      query: "query($name: String!) { hello(name: $name) }",
      variables: { name: "Nest" },
    });
    assert.equal(hello.status, 200);
    assert.deepEqual(hello.body, { data: { hello: "Hello Nest" } });
    result.push(hello);
    const mutation = await json({ query: "mutation { add(a: 2, b: 3) }" });
    assert.deepEqual(mutation, { status: 200, body: { data: { add: 5 } } });
    result.push(mutation);
    const denied = await json({ query: "{ secured }" });
    assert.equal(denied.body.errors[0].extensions.code, "UNAUTHENTICATED");
    result.push(denied);
    const allowed = await json({ query: "{ secured }" }, { "x-auth": "yes" });
    assert.deepEqual(allowed.body, { data: { secured: "authorized" } });
    result.push(allowed);
    const blocked = await json({ query: "{ secured }" }, { "x-auth": "yes", "x-block": "yes" });
    assert.equal(blocked.status, 429);
    assert.equal(blocked.body.errors[0].extensions.code, "QUOTA_LIMIT_REACHED");
    result.push(blocked);
    const concurrent = await Promise.all(
      Array.from({ length: 12 }, async (_, index) => {
        const auth = index % 2 ? "yes" : "no";
        const response = await json(
          { query: "{ isolated }" },
          { "x-request-id": String(index), "x-auth": auth },
        );
        assert.deepEqual(response, {
          status: 200,
          body: { data: { isolated: `${index}:${auth}` } },
        });
        return response;
      }),
    );
    result.push(...concurrent);
    assert.ok(pluginState.maxActive > 1, "The fixture must exercise overlapping requests");
    for (const query of ["{ unknown }", "{", "query($name: String!) { hello(name: $name) }"]) {
      const error = await json({ query });
      assert.equal(error.status, query.includes("$name") ? 200 : 400);
      result.push(error);
    }
    const get = await fetch(
      `${base}/v1/gql?query=${encodeURIComponent('{ hello(name: "GET") }')}`,
      {
        headers: { "apollo-require-preflight": "true" },
      },
    );
    assert.equal(get.status, 200);
    assert.deepEqual(await get.json(), { data: { hello: "Hello GET" } });
    const csrf = await fetch(
      `${base}/v1/gql?query=${encodeURIComponent('{ hello(name: "GET") }')}`,
    );
    assert.equal(csrf.status, 400);
    await csrf.text();
    const preflight = await fetch(`${base}/v1/gql`, {
      method: "OPTIONS",
      headers: { origin: "https://fixture.test", "access-control-request-method": "POST" },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get("access-control-allow-origin"), "*");
    if (mode !== "express") {
      const missing = await fetch(`${base}/v1/gql/unexpected`);
      assert.equal(missing.status, 404);
      await missing.text();
    }
    reports[contextKind] = result;
  } finally {
    await app.close();
  }
  assert.equal(stopped, true, "Apollo stops with the Nest application");
  assert.equal(pluginState.started, 1, "Nest discovers and starts the injected plugin once");
  assert.equal(pluginState.stopped, 1, "Nest stops the discovered plugin once");
  assert.equal(pluginState.active.size, 0, "All plugin request lifecycles finish");
  assert.equal(pluginState.completed, 21, "Plugins see successful and failed GraphQL requests");
}
if (mode !== "express") {
  assert.deepEqual(
    reports.object,
    reports.function,
    "Object context must be isolated for every request",
  );
  const driver = Object.create(NativeApolloDriver.prototype);
  await assert.rejects(driver.start({ subscriptions: {} }), /not subscriptions/);
  driver.httpAdapterHost = { httpAdapter: { getType: () => "express" } };
  await assert.rejects(driver.registerServer({}), /requires NodeHttpAdapter or BunHttpAdapter/);
}
await import("node:fs/promises").then(({ writeFile }) =>
  writeFile(`${mode}.json`, JSON.stringify(reports)),
);
console.log(
  `${mode}: Apollo operations, concurrent contexts, injected plugins and HTTP lifecycle passed`,
);
