import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BadRequestException } from "@nestjs/common";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { parseDiskMultipart } from "../shared/multipart.js";
import { createRequest } from "../shared/request.js";

const diskFailure = vi.hoisted(() => ({ enabled: false }));
vi.mock("node:fs", async (importOriginal) => {
  const fs = await importOriginal<typeof import("node:fs")>();
  return {
    ...fs,
    createWriteStream: (...args: Parameters<typeof fs.createWriteStream>) =>
      fs.createWriteStream(diskFailure.enabled ? `${String(args[0])}/missing` : args[0], args[1]),
  };
});

afterEach(() => {
  diskFailure.enabled = false;
});

it("preserves a disk write error and removes the request's upload directory", async () => {
  const directory = await mkdtemp(join(tmpdir(), "native-disk-failure-"));
  try {
    const form = new FormData();
    form.append("file", new Blob(["fixture"]), "fixture.txt");
    const request = createRequest(
      new Request("http://localhost/upload", { method: "POST", body: form }),
    );
    diskFailure.enabled = true;
    await expect(parseDiskMultipart(request, 4096, directory)).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(await readdir(directory)).toEqual([]);
  } finally {
    await rm(directory, { recursive: true });
  }
});

it("treats parser errors propagated through a file write as client errors", async () => {
  const directory = await mkdtemp(join(tmpdir(), "native-parser-failure-"));
  try {
    const request = createRequest(
      new Request("http://localhost/upload", {
        method: "POST",
        headers: { "content-type": "multipart/form-data; boundary=truncated" },
        body: '--truncated\r\nContent-Disposition: form-data; name="file"; filename="partial.txt"\r\n\r\npartial',
      }),
    );
    await expect(parseDiskMultipart(request, 4096, directory)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(await readdir(directory)).toEqual([]);
  } finally {
    await rm(directory, { recursive: true });
  }
});

it("does not open a disk file when the filter skips it", async () => {
  const directory = await mkdtemp(join(tmpdir(), "native-skipped-file-"));
  try {
    const form = new FormData();
    form.append("file", new Blob(["skip"]), "skip.txt");
    const encoded = new Response(form);
    const request = createRequest(
      new Request("http://localhost/upload", {
        method: "POST",
        headers: { "content-type": encoded.headers.get("content-type")! },
        body: await encoded.arrayBuffer(),
      }),
    );
    diskFailure.enabled = true;
    const parsed = await parseDiskMultipart(
      request,
      4096,
      directory,
      1024,
      1,
      (_request, _file, callback) => callback(null, false),
    );
    expect(parsed.files).toEqual([]);
    const [destination] = await readdir(directory);
    expect(await readdir(join(directory, destination!))).toEqual([]);
    await parsed.cleanup();
    expect(await readdir(directory)).toEqual([]);
  } finally {
    await rm(directory, { recursive: true });
  }
});
