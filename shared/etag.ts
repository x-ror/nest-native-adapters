import * as crypto from "node:crypto";

/** Express's `etag fn`: returns the ETag for a response body, or nothing to skip it. */
export type ETagFunction = (body: Buffer, encoding: string) => string | undefined;

/** Express's `etag` setting: `true`/`"weak"` (default), `"strong"`, `false` or a function. */
export type ETagSetting = boolean | "weak" | "strong" | ETagFunction;

// One-shot crypto.hash (Node 21.7+, Bun) is several times cheaper than createHash for small bodies.
const sha1Base64: (body: Buffer) => string =
  typeof crypto.hash === "function"
    ? (body) => crypto.hash("sha1", body, "base64")
    : (body) => crypto.createHash("sha1").update(body).digest("base64");

/** The `etag` package for a body: `"<length hex>-<sha1 base64, 27 chars>"`. */
function entityTag(body: Buffer): string {
  if (body.length === 0) return '"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk"';
  const hash = sha1Base64(body).substring(0, 27);
  return `"${body.length.toString(16)}-${hash}"`;
}

/** Express's `compileETag`. */
export function compileETag(value: unknown): ETagFunction | undefined {
  if (typeof value === "function") return value as ETagFunction;
  switch (value) {
    case true:
    case "weak":
      return (body) => `W/${entityTag(body)}`;
    case "strong":
      return (body) => entityTag(body);
    case false:
      return undefined;
    default:
      throw new TypeError(`unknown value for etag function: ${String(value)}`);
  }
}
