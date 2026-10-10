import type { NativeRequest } from "./request.js";

/** What `fresh()` reads from a response. */
interface ResponseHeaders {
  getHeader(name: string): string | string[] | number | undefined;
}

/** send's token list parser for If-Match / If-None-Match. */
export function parseTokenList(value: string): string[] {
  const list: string[] = [];
  let start = 0;
  let end = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code === 0x20) {
      if (start === end) start = end = i + 1;
    } else if (code === 0x2c) {
      if (start !== end) list.push(value.slice(start, end));
      start = end = i + 1;
    } else end = i + 1;
  }
  if (start !== end) list.push(value.slice(start, end));
  return list;
}

export const parseHttpDate = (value: unknown): number =>
  typeof value === "string" ? Date.parse(value) : Number.NaN;

/** The `fresh` package: whether a conditional GET can be answered with 304. */
export function isFresh(req: NativeRequest, res: ResponseHeaders): boolean {
  const modifiedSince = req.headers["if-modified-since"];
  const noneMatch = req.headers["if-none-match"];
  if (!modifiedSince && !noneMatch) return false;
  const cacheControl = req.headers["cache-control"];
  if (cacheControl && /(?:^|,)\s*?no-cache\s*?(?:,|$)/.test(cacheControl)) return false;
  if (noneMatch) {
    if (noneMatch === "*") return true;
    const etag = res.getHeader("etag") as string | undefined;
    if (!etag) return false;
    return parseTokenList(noneMatch).some(
      (match) => match === etag || match === `W/${etag}` || `W/${match}` === etag,
    );
  }
  const lastModified = res.getHeader("last-modified");
  return Boolean(lastModified) && parseHttpDate(lastModified) <= parseHttpDate(modifiedSince);
}
