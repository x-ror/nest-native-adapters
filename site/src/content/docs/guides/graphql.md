---
title: GraphQL
description: The experimental NativeApolloDriver.
---

The standard Nest `ApolloDriver` only recognizes Express and Fastify and
rejects these adapters. The experimental workspace package `packages/apollo`
provides `NativeApolloDriver` for Nest 10 with Apollo 4 and Nest 12 with
Apollo 5. Its [README](https://github.com/x-ror/nest-native-adapters/blob/main/packages/apollo/README.md) covers usage and
limitations. The package is not published to npm, and neither HTTP adapter
depends on it. It supports HTTP queries and mutations, but not subscriptions.
