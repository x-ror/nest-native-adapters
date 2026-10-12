import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConflictException } from "@nestjs/common";
import { expect, it } from "vite-plus/test";
import { parseDiskMultipart, parseMemoryMultipart } from "../shared/multipart.js";
import { createRequest } from "../shared/request.js";
import { AnyFilesInterceptor, type UploadFileFilter } from "../shared/uploads.js";

async function requestFor(names: string[]) {
  const form = new FormData();
  form.append("note", "before");
  for (const name of names) form.append("file", new Blob([name], { type: "text/plain" }), name);
  const encoded = new Response(form);
  return createRequest(
    new Request("http://localhost/upload", {
      method: "POST",
      headers: { "content-type": encoded.headers.get("content-type")! },
      body: await encoded.arrayBuffer(),
    }),
  );
}

it("filters before storage, preserves file order with delayed callbacks and exposes preceding fields", async () => {
  const directory = await mkdtemp(join(tmpdir(), "native-filter-"));
  try {
    for (const disk of [false, true]) {
      const seen: string[] = [];
      const filter: UploadFileFilter = (request, file, callback) => {
        expect(request.body).toMatchObject({ note: "before" });
        expect(file).toEqual({
          fieldname: "file",
          originalname: file.originalname,
          encoding: "7bit",
          mimetype: "text/plain",
        });
        expect("buffer" in file).toBe(false);
        expect("path" in file).toBe(false);
        seen.push(file.originalname);
        setTimeout(
          () => callback(null, file.originalname !== "skip.txt"),
          file.originalname === "first.txt" ? 20 : 0,
        );
      };
      const request = await requestFor(["first.txt", "skip.txt", "last.txt"]);
      const parsed = disk
        ? await parseDiskMultipart(request, 4096, directory, 1024, 3, filter)
        : await parseMemoryMultipart(request, 4096, 1024, 3, filter);
      expect(seen).toEqual(["first.txt", "skip.txt", "last.txt"]);
      if (disk) {
        expect(parsed.files.map((file) => file.originalname)).toEqual(["first.txt", "last.txt"]);
        expect(await readdir(parsed.files[0]!.destination)).toHaveLength(2);
        expect(await readFile(parsed.files[0]!.path, "utf8")).toBe("first.txt");
      } else {
        expect((parsed.body.file as File[]).map((file) => file.name)).toEqual([
          "first.txt",
          "last.txt",
        ]);
      }
      await parsed.cleanup();
      expect(await readdir(directory)).toEqual([]);
    }
  } finally {
    await rm(directory, { recursive: true });
  }
});

it("preserves callback and thrown errors, and cleans files already accepted", async () => {
  const directory = await mkdtemp(join(tmpdir(), "native-filter-error-"));
  try {
    for (const disk of [false, true]) {
      for (const thrown of [false, true]) {
        const error = new ConflictException("filter rejected");
        const filter: UploadFileFilter = (_request, file, callback) => {
          if (file.originalname === "first.txt") callback(null, true);
          else if (thrown) throw error;
          else setTimeout(() => callback(error), 10);
        };
        const request = await requestFor(["first.txt", "error.txt"]);
        const result = disk
          ? parseDiskMultipart(request, 4096, directory, 1024, 2, filter)
          : parseMemoryMultipart(request, 4096, 1024, 2, filter);
        await expect(result).rejects.toBe(error);
        expect(await readdir(directory)).toEqual([]);
      }
    }
  } finally {
    await rm(directory, { recursive: true });
  }
});

it("drains skipped files without storing them, but counts them toward total file limits", async () => {
  const filter: UploadFileFilter = (_request, _file, callback) => callback(null, false);
  const parsed = await parseMemoryMultipart(await requestFor(["skip.txt"]), 4096, 0, 1, filter);
  expect(parsed.body).toEqual({ note: "before" });
  await expect(
    parseMemoryMultipart(await requestFor(["a", "b"]), 4096, 1024, 1, filter),
  ).rejects.toMatchObject({ status: 413 });
});

it("validates filter configuration and callback decisions", async () => {
  expect(() => AnyFilesInterceptor({ fileFilter: false as never })).toThrow("fileFilter");
  const filter: UploadFileFilter = (_request, _file, callback) => callback(null);
  await expect(
    parseMemoryMultipart(await requestFor(["a"]), 4096, 1024, 1, filter),
  ).rejects.toThrow("boolean acceptance");
});
