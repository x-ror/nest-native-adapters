---
title: Shutdown
description: Graceful shutdown, shutdownTimeout and lifecycle hooks.
---

`app.close()` stops accepting connections and waits for in-flight requests to
finish. `shutdownTimeout` (default 5000 ms) limits that wait, and it also
applies to long-lived connections such as SSE. When it expires, the adapter
closes the remaining connections. Nest's `forceCloseConnections: true`
application option skips the wait. Closing an SSE connection unsubscribes its
Observable.

Nest runs `onModuleDestroy()` and `beforeApplicationShutdown()` before it
closes the HTTP adapter, and `onApplicationShutdown()` afterward. In-flight
handlers may still run during the first two hooks, so release the resources
they need in `onApplicationShutdown()`. `shutdownTimeout` limits HTTP draining
only, not the application's own asynchronous shutdown hooks.
