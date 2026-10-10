import { isIP } from "node:net";
import { BadRequestException, PayloadTooLargeException } from "@nestjs/common";
import { hostnameOf, resolveProxy, type ProxyView, type TrustFunction } from "./proxy.js";

export interface NativeRequest {
  raw: Request;
  method: string;
  url: string;
  originalUrl: string;
  path: string;
  /**
   * The `Host` header without its port, or `X-Forwarded-Host` from a trusted
   * proxy; `undefined` when a trusted proxy sends an empty one, as on Express.
   */
  hostname: string;
  /** `http`/`https`, or `X-Forwarded-Proto` from a trusted proxy. */
  protocol: string;
  /** The client address: the socket peer, or the nearest untrusted `X-Forwarded-For` entry. */
  ip?: string;
  /** Trusted `X-Forwarded-For` chain, farthest first, as Express's `req.ips`; empty without `trustProxy`. */
  ips: string[];
  /** Express's `req.secure`: `protocol === "https"`. */
  readonly secure: boolean;
  /** Express's `req.host`: the Host header (or trusted `X-Forwarded-Host`), port included. */
  readonly host: string | undefined;
  /**
   * Express's `req.subdomains`: the hostname's labels, nearest first, minus the
   * `subdomain offset` setting (default 2). Empty for IP addresses.
   */
  readonly subdomains: string[];
  headers: Record<string, string>;
  params: Record<string, string | string[]>;
  query: Record<string, string | string[]>;
  body?: unknown;
  rawBody?: Buffer;
  /**
   * Set by `cookie-parser` when the application installs it, exactly as on
   * Express. Nest's `@Cookies()` and `@SignedCookies()` do not need it.
   */
  cookies?: Record<string, any>;
  /** Set by `cookie-parser`; see `cookies`. */
  signedCookies?: Record<string, any>;
  /** The first secret given to `cookie-parser`, when it is installed. */
  secret?: string;
}

// Prototype-free like new NullObject(), but stays a fast-mode V8 object:
// several times cheaper to fill, iterate and JSON.stringify.
export const NullObject = function () {} as unknown as new <T = unknown>() => Record<string, T>;
NullObject.prototype = Object.create(null);

function decodeQueryPart(text: string): string {
  if (!text.includes("%") && !text.includes("+")) return text;
  const spaced = text.replaceAll("+", " ");
  try {
    return decodeURIComponent(spaced);
  } catch {
    return spaced;
  }
}

// Repeated keys become arrays; keys without "=" get an empty string.
export function parseQuery(search: string): Record<string, string | string[]> {
  const result = new NullObject<string | string[]>();
  for (let start = 0; start < search.length;) {
    let end = search.indexOf("&", start);
    if (end === -1) end = search.length;
    if (end > start) {
      const equals = search.indexOf("=", start);
      const split = equals !== -1 && equals < end ? equals : end;
      const key = decodeQueryPart(search.slice(start, split));
      const value = split === end ? "" : decodeQueryPart(search.slice(split + 1, end));
      const previous = result[key];
      if (previous === undefined) result[key] = value;
      else if (typeof previous === "string") result[key] = [previous, value];
      else previous.push(value);
    }
    start = end + 1;
  }
  return result;
}

function formFieldPath(key: string): string[] {
  const rootEnd = key.indexOf("[");
  const root = rootEnd === -1 ? key : key.slice(0, rootEnd);
  if (!root) throw new BadRequestException("Invalid form field name");
  const path = [root];
  let offset = root.length;
  while (offset < key.length) {
    if (key[offset] !== "[") throw new BadRequestException("Invalid form field name");
    const end = key.indexOf("]", offset + 1);
    if (end === -1) throw new BadRequestException("Invalid form field name");
    path.push(key.slice(offset + 1, end));
    offset = end + 1;
  }
  if (path.some((part) => ["__proto__", "prototype", "constructor"].includes(part))) {
    throw new BadRequestException("Invalid form field name");
  }
  return path;
}

function assignFormValue(target: unknown, path: string[], value: FormDataEntryValue): void {
  const [part, ...rest] = path;
  if (part === undefined) return;
  const isArray = Array.isArray(target);
  if (part === "") {
    if (!isArray) throw new BadRequestException("Conflicting form field names");
    if (!rest.length) {
      target.push(value);
      return;
    }
    const nextPart = rest[0]!;
    const child = nextPart === "" || /^\d+$/.test(nextPart) ? [] : new NullObject();
    target.push(child);
    assignFormValue(child, rest, value);
    return;
  }
  if (isArray) {
    if (!/^\d+$/.test(part) || Number(part) > 10_000)
      throw new BadRequestException("Invalid form array index");
    const index = Number(part);
    if (!rest.length) {
      const existing = target[index];
      if (existing === undefined) target[index] = value;
      else if (Array.isArray(existing)) existing.push(value);
      else target[index] = [existing, value];
      return;
    }
    const nextPart = rest[0]!;
    const existing = target[index];
    const child =
      existing && typeof existing === "object"
        ? existing
        : nextPart === "" || /^\d+$/.test(nextPart)
          ? []
          : new NullObject();
    target[index] = child;
    assignFormValue(child, rest, value);
    return;
  }
  if (target === null || typeof target !== "object")
    throw new BadRequestException("Conflicting form field names");
  const object = target as Record<string, unknown>;
  if (!rest.length) {
    const existing = object[part];
    if (existing === undefined) object[part] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else object[part] = [existing, value];
    return;
  }
  const nextPart = rest[0]!;
  const existing = object[part];
  const child =
    existing && typeof existing === "object"
      ? existing
      : nextPart === "" || /^\d+$/.test(nextPart)
        ? []
        : new NullObject();
  object[part] = child;
  assignFormValue(child, rest, value);
}

function nestedFormObject(
  entries: Iterable<[string, FormDataEntryValue]>,
): Record<string, unknown> {
  const result = new NullObject();
  for (const [key, value] of entries) assignFormValue(result, formFieldPath(key), value);
  return result;
}

// Bun's native `Headers#toJSON` is several times cheaper than iterating entries.
function headersObject(headers: Headers): Record<string, string> {
  const native = headers as Headers & { toJSON?: () => Record<string, string> };
  return native.toJSON ? native.toJSON() : Object.fromEntries(headers);
}

/** Express's default `subdomain offset` setting. */
export const DEFAULT_SUBDOMAIN_OFFSET = 2;

/** Express's `req.subdomains`; like Express, the offset goes to `Array#slice` as given. */
export function subdomainsOf(hostname: string | undefined, offset: unknown): string[] {
  if (!hostname) return [];
  return (isIP(hostname) ? [hostname] : hostname.split(".").reverse()).slice(offset as number);
}

/** What a request facade knows about its connection before `trust proxy` applies. */
export interface ClientConnection {
  socketAddress: string | undefined;
  /** `http` or `https` of the connection itself. */
  protocol: string;
  /** The Host header (port included), or undefined when the client sent none. */
  host: string | undefined;
}

/**
 * Express's client getters (`ip`, `ips`, `protocol`, `secure`, `host`,
 * `hostname`, `subdomains`), shared by the Node and fetch facades. With a
 * trust function they follow trusted `X-Forwarded-*` headers, computed once
 * on first read so the trust function runs inside the handler's error
 * handling; without one they describe the connection.
 */
export abstract class ClientRequest {
  abstract readonly headers: Record<string, string>;
  #view: ProxyView | undefined;

  constructor(
    private readonly trust: TrustFunction | undefined,
    private readonly subdomainOffset: unknown,
  ) {}

  protected abstract connection(): ClientConnection;

  private view(): ProxyView {
    if (this.#view) return this.#view;
    const { socketAddress, protocol, host } = this.connection();
    const headers = this.headers;
    return (this.#view = resolveProxy(
      {
        socketAddress,
        protocol,
        host,
        forwardedFor: headers["x-forwarded-for"],
        forwardedProto: headers["x-forwarded-proto"],
        forwardedHost: headers["x-forwarded-host"],
      },
      this.trust!,
    ));
  }
  get ip(): string | undefined {
    return this.trust ? this.view().ip : this.connection().socketAddress;
  }
  get ips(): string[] {
    return this.trust ? this.view().ips : [];
  }
  get protocol(): string {
    return this.trust ? this.view().protocol : this.connection().protocol;
  }
  get secure(): boolean {
    return this.protocol === "https";
  }
  get host(): string | undefined {
    return (this.trust ? this.view().host : this.connection().host) || undefined;
  }
  /**
   * The host without its port. A request without a Host header reports
   * `localhost`; an empty trusted `X-Forwarded-Host` gives `undefined`, as on Express.
   */
  get hostname(): string {
    const host = this.host;
    if (host === undefined && this.connection().host === undefined) return "localhost";
    return hostnameOf(host)!;
  }
  get subdomains(): string[] {
    return subdomainsOf(this.hostname, this.subdomainOffset);
  }
}

/** Request facade over a fetch `Request`; URL parts are sliced without a reparse. */
class FetchRequest extends ClientRequest implements NativeRequest {
  readonly method: string;
  url: string;
  originalUrl: string;
  path: string;
  readonly headers: Record<string, string>;
  params = new NullObject<string | string[]>();
  query: Record<string, string | string[]>;
  body?: unknown;
  rawBody?: Buffer;
  readonly #connection: ClientConnection;

  constructor(
    readonly raw: Request,
    ip: string | undefined,
    trust: TrustFunction | undefined,
    subdomainOffset: unknown,
    defaultProtocol: string,
  ) {
    super(trust, subdomainOffset);
    // `Request.url` is normally an absolute, normalized URL; slicing avoids a reparse.
    // Bun hands over the bare request target instead ("/path?query") when the
    // Host header is missing or invalid, so a relative URL must not be sliced as
    // if it had a scheme and host: that used to drop its first path segment.
    const full = raw.url;
    let url: string;
    let protocol: string;
    let urlHost = "";
    if (full.charCodeAt(0) === 47) {
      url = full;
      protocol = defaultProtocol;
    } else {
      const hostStart = full.indexOf("://") + 3;
      const pathStart = full.indexOf("/", hostStart);
      url = pathStart === -1 ? "/" : full.slice(pathStart);
      protocol = full.slice(0, hostStart - 3);
      urlHost = full.slice(hostStart, pathStart === -1 ? undefined : pathStart);
    }
    const queryStart = url.indexOf("?");
    this.method = raw.method;
    this.url = url;
    this.originalUrl = url;
    this.path = queryStart === -1 ? url : url.slice(0, queryStart);
    this.headers = headersObject(raw.headers);
    this.query = queryStart === -1 ? new NullObject() : parseQuery(url.slice(queryStart + 1));
    // Like Express, the host comes from the Host header; the URL's is a fallback
    // for Requests built without one.
    this.#connection = {
      socketAddress: ip,
      protocol,
      host: this.headers.host || urlHost.replace(/^.*@/, "") || undefined,
    };
  }
  protected connection(): ClientConnection {
    return this.#connection;
  }
}

export function createRequest(
  raw: Request,
  ip?: string,
  trust?: TrustFunction,
  subdomainOffset: unknown = DEFAULT_SUBDOMAIN_OFFSET,
  /** The server's own scheme, for Requests whose URL carries none. */
  protocol = "http",
): NativeRequest {
  return new FetchRequest(raw, ip, trust, subdomainOffset, protocol);
}

export type BodyReader = (request: NativeRequest, limit: number) => Promise<Buffer> | Buffer | null;

export async function readWebBody(
  body: ReadableStream<Uint8Array>,
  limit: number,
): Promise<Buffer> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new PayloadTooLargeException();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
}

export function isParsedMethod(method: string): boolean {
  return method !== "GET" && method !== "HEAD";
}

export type BodyKind = "json" | "urlencoded" | "multipart" | "text" | "raw";

export function mediaType(contentType: string | undefined): string | undefined {
  return contentType?.split(";")[0]?.trim().toLowerCase();
}

/** What the built-in parser handles when no custom parser claimed the body. */
export function defaultBodyKind(type: string | undefined): BodyKind | undefined {
  if (type === "application/json" || type?.endsWith("+json")) return "json";
  if (type === "application/x-www-form-urlencoded") return "urlencoded";
  if (type === "multipart/form-data") return "multipart";
  return undefined;
}

export async function parseRequestBody(
  request: NativeRequest,
  kind: BodyKind,
  limit: number,
  rawBody: boolean,
  read: BodyReader,
): Promise<void> {
  const bytes = await read(request, limit);
  if (bytes === null) return;
  if (rawBody) request.rawBody = bytes;
  if (kind === "raw") {
    request.body = bytes;
    return;
  }
  if (kind === "text") {
    request.body = bytes.toString("utf8");
    return;
  }
  if (!bytes.length && kind !== "multipart") {
    request.body = {};
    return;
  }
  if (kind === "multipart") {
    try {
      const formData = await new Response(bytes as unknown as BodyInit, {
        headers: { "content-type": request.headers["content-type"]! },
      }).formData();
      request.body = nestedFormObject(formData.entries());
      return;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException("Invalid multipart form data");
    }
  }
  const text = bytes.toString("utf8");
  if (kind === "urlencoded") {
    request.body = nestedFormObject(new URLSearchParams(text));
    return;
  }
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed === null || typeof parsed !== "object")
      throw new SyntaxError("JSON body must be an object or array");
    request.body = parsed;
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    throw new BadRequestException("Invalid JSON request body");
  }
}
