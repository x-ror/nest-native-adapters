---
title: Cookies
description: Nest cookie decorators, cookie-parser and res.cookie().
---

Nest's own cookie support works unchanged on both adapters: `@Cookies()`,
`@SignedCookies()`, `httpAdapter.setCookie()` / `clearCookie()` and the
`cookies: { secret }` application option. The decorators parse the `Cookie`
header themselves, so they need no middleware.

Like Express, the adapters do not fill `req.cookies` or `req.signedCookies`.
To use them in middleware and guards, install `cookie-parser` as on Express
with `app.use(cookieParser(secret))`. It works unchanged, including `j:` JSON
cookies and signed cookies. `@SignedCookies()` falls back to its result
when `cookies.secret` is not configured. Signatures use the same
`s:value.signature` format everywhere, so give both the same secret.

For `@Res()` handlers migrated from Express, `NativeResponse` offers
`res.cookie(name, value, options)` and `res.clearCookie(name, options)` with
Express semantics:

- Objects become `j:`-prefixed JSON, and other values are stringified.
- `maxAge` is in milliseconds and also sets `Expires`. `null` leaves it out.
  Nest's `httpAdapter.setCookie()` takes `maxAge` in seconds.
- `null` or `false` for `domain`, `expires`, `priority` and `sameSite` leaves
  the attribute out. `sameSite: true` means `Strict`. A falsy `path` sends an
  empty `Path=`, which browsers treat like Express's missing Path.
- `signed: true` uses the secret that `cookie-parser` set, as Express does,
  and otherwise `cookies.secret`.

Nest serializes the cookies, so an invalid name, value or attribute throws a
`TypeError`, and `sameSite: "none"` or `partitioned` requires `secure: true`.
Express's `encode` option is not supported and throws.

```ts
@Get("login")
login(@Res() res: NativeResponse) {
  res
    .cookie("session", token, { httpOnly: true, secure: true, maxAge: 86_400_000 })
    .cookie("theme", "dark")
    .json({ ok: true });
}

@Get("me")
me(@Cookies("theme") theme: string, @SignedCookies("uid") uid?: string) {
  return { theme, uid };
}
```
