---
title: Trusted proxies
description: X-Forwarded-* handling with Express's trust proxy values.
---

By default the adapters ignore `X-Forwarded-*` headers, as Express does.
`req.ip`, `@Ip()`, `req.protocol` and `req.hostname` describe the direct
connection to the application. Behind a reverse proxy, tell the adapter which
hops to trust, with the same values as Express's `trust proxy` setting:

```ts
new NodeHttpAdapter({ trustProxy: "loopback" }); // or BunHttpAdapter
// or, as on Express, after creating the app:
app.set("trust proxy", 1);
```

| Value                       | Trusts                                                                    |
| --------------------------- | ------------------------------------------------------------------------- |
| `false` (default), `0`      | nothing                                                                   |
| `true`                      | every hop; only when nothing else can reach the app                       |
| a number `n`                | the nearest `n` hops                                                      |
| a string or array           | addresses, CIDR or netmask ranges, `loopback`, `linklocal`, `uniquelocal` |
| `(address, hop) => boolean` | whatever the function accepts; hop 0 is the socket peer                   |

With a trusted socket peer, `req.ip` becomes the nearest untrusted
`X-Forwarded-For` entry, `req.ips` lists the trusted chain farthest first,
`req.protocol` follows `X-Forwarded-Proto`, and `req.hostname` follows
`X-Forwarded-Host`. `req.host`, `req.secure` and `req.subdomains` use those
resolved values.

An invalid value, including a `/0` range, throws when you create the adapter
or apply the setting, so the app fails at startup as on Express. `null`,
`false` and `""` trust nothing.

`app.set()` accepts any setting, but only `trust proxy` and
`subdomain offset` have an effect. `x-powered-by` is accepted without a
warning, because these adapters never send that header. Any other setting
logs a warning that the adapter ignores it.

:::caution
Trust only the proxies in front of the application. With
`true` or a hop count larger than the real proxy chain, any client can set
its own `req.ip` through `X-Forwarded-For`.
:::
