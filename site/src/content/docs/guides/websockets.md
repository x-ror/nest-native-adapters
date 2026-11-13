---
title: WebSockets
description: WsAdapter on Node, BunWsAdapter on Bun, and Socket.IO.
---

Packed consumers cover separate gateway paths, `handleConnection()` and
`handleDisconnect()` exactly once per client, and gateway-managed shutdown
with active clients across Nest 10/11/12 on Node/Bun.

For portable shutdown with legacy Nest `WsAdapter`, track connected clients
and call their `close()` in the gateway's `beforeApplicationShutdown()` hook.
Older `WsAdapter` versions can otherwise wait indefinitely for active
clients. This WebSocket shutdown phase runs before HTTP adapter draining,
so the adapter's `shutdownTimeout` does not bound it.

All WebSocket integrations need `@nestjs/websockets` installed in the application.

On Node the adapter's server is a Node `http.Server`, so Nest's own adapter
from `@nestjs/platform-ws` works unchanged:

```ts
import { WsAdapter } from "@nestjs/platform-ws";
app.useWebSocketAdapter(new WsAdapter(app));
```

On Bun use the bundled adapter, which runs on Bun's native WebSockets and
shares the HTTP port:

```ts
import { BunHttpAdapter, BunWsAdapter } from "nestjs-adapter-bun";
const app = await NestFactory.create(AppModule, new BunHttpAdapter());
app.useWebSocketAdapter(new BunWsAdapter(app));
```

`BunWsAdapter` uses the same `{ "event": ..., "data": ... }` JSON messages as
`WsAdapter`. It matches gateways by `@WebSocketGateway({ path })` and does not
support separate ports or namespaces. `@ConnectedSocket()` is Bun's
`ServerWebSocket`. Other integrations can share the Bun server through
`BunHttpAdapter#addSocketTransport`.

## Socket.IO

With `NodeHttpAdapter`, install `@nestjs/platform-socket.io` and nothing else.
Nest attaches Socket.IO to the adapter's `http.Server` itself, as it does with
Express. This also works when the application runs under Bun, so use
`NodeHttpAdapter` for Socket.IO on Bun.

`BunHttpAdapter` does not support Socket.IO or `@nestjs/platform-ws`, because
both need a Node HTTP server, which `Bun.serve` does not provide. Such an
application fails at startup with an error that names the cause.
