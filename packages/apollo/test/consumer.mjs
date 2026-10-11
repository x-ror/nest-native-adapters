import "reflect-metadata";
import assert from "node:assert/strict";
import { Module, UnauthorizedException } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ApolloDriver } from "@nestjs/apollo";
import { GraphQLModule } from "@nestjs/graphql";
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
  const options = {
    driver: mode === "express" ? ApolloDriver : NativeApolloDriver,
    path: "/gql",
    useGlobalPrefix: true,
    playground: false,
    typeDefs: `
      type Query { hello(name: String!): String!, secured: String! }
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
  Module({ imports: [GraphQLModule.forRoot(options)] })(TestModule);
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
  `${mode}: Apollo queries, mutations, context, errors, GET, CSRF, CORS and shutdown passed`,
);
