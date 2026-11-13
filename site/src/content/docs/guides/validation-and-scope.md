---
title: Validation and request scope
description: Global enhancers, ValidationPipe and request-scoped providers.
---

Global guards, pipes, interceptors and filters registered through Nest's
`APP_GUARD`, `APP_PIPE`, `APP_INTERCEPTOR` and `APP_FILTER` tokens support DI,
including `useExisting` providers. Packed consumers cover their execution
order, parameter transformation, guard/pipe/handler errors and concurrent
requests on Nest 10/11/12 and Node/Bun. A global exception filter can inject
`HttpAdapterHost` and use `httpAdapter.reply()` without depending on Express.

Use Nest's `ValidationPipe` with `class-validator` and `class-transformer`
installed in the application. Compile DTO classes with
`experimentalDecorators: true` and `emitDecoratorMetadata: true`, and load
`reflect-metadata` before the application. Without emitted metadata, Nest
cannot infer the DTO type for global validation.

The adapters support Nest's request-scoped DI (`Scope.REQUEST` and the
`REQUEST` injection token). Middleware, guards, interceptors, filters and the
controller share one instance of a scoped provider within a request. Separate
requests get separate instances. Nest's scope bubbling applies. A controller
or provider that depends on a request-scoped provider becomes request-scoped
without an explicit scope.

For request-scoped global enhancers, declare `scope: Scope.REQUEST` on the
`APP_*` provider itself:

```ts
{ provide: APP_GUARD, useClass: TenantGuard, scope: Scope.REQUEST }
```

The same registration applies to `APP_PIPE`, `APP_INTERCEPTOR` and `APP_FILTER`.
Do not rely on `useExisting` to infer request scope for a global enhancer:
Nest chooses global enhancer registration from the `APP_*` provider metadata.
Packed consumers cover one shared `REQUEST` and scoped dependency across these
enhancers and the controller, including parameter pipes, asynchronous handlers,
guard/pipe/handler errors and concurrent requests on Nest 10/11/12 and Node/Bun.
