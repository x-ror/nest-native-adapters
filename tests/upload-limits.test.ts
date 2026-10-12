import "reflect-metadata";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  Body,
  Controller,
  Module,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host.js";
import { of } from "rxjs";
import { expect, it } from "vite-plus/test";
import {
  AnyFilesInterceptor,
  FileFieldsInterceptor,
  FileInterceptor,
  FilesInterceptor,
  NodeHttpAdapter,
  type NativeRequest,
  type UploadedFile as Upload,
} from "nestjs-adapter-node";
import { parseMemoryMultipart } from "../shared/multipart.js";
import { createRequest } from "../shared/request.js";

class UploadGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<NativeRequest>();
    expect(request.body).toBeUndefined();
    expect(request.uploads).toBeUndefined();
    return request.headers["x-allow"] === "yes";
  }
}

@Controller("upload")
@UseGuards(UploadGuard)
class UploadController {
  @Post("small")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 4, files: 1 } }))
  small(@UploadedFile() file: Upload, @Body() body: Record<string, unknown>) {
    return { size: file.size, note: body.note };
  }
  @Post("large")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 16 } }))
  large(@UploadedFile() file: Upload, @Req() request: NativeRequest) {
    return { size: file.size, disk: !!request.uploads?.length };
  }
}
@Module({ controllers: [UploadController] })
class UploadModule {}

it("validates local limits on every upload interceptor", () => {
  for (const value of [NaN, Infinity, -1, 1.5]) {
    const options = { limits: { fileSize: value } };
    expect(() => FileInterceptor("file", options)).toThrow("fileSize");
    expect(() => FilesInterceptor("file", 2, options)).toThrow("fileSize");
    expect(() => FileFieldsInterceptor([{ name: "file" }], options)).toThrow("fileSize");
    expect(() => AnyFilesInterceptor(options)).toThrow("fileSize");
    expect(() => AnyFilesInterceptor({ limits: { files: value } })).toThrow("files");
  }
  expect(() => AnyFilesInterceptor({ limits: { fileSize: 0, files: 0 } })).not.toThrow();
  expect(() => new NodeHttpAdapter({ uploadParsing: "invalid" as never })).toThrow("uploadParsing");
  expect(() =>
    new NodeHttpAdapter({ uploadParsing: "interceptor" }).initHttpServer({
      rawBody: true,
    }),
  ).toThrow("rawBody");
});

it("reports misconfiguration instead of checking streaming limits retroactively", async () => {
  const Interceptor = FileInterceptor("file", { limits: { fileSize: 4 } });
  const context = new ExecutionContextHost([
    {
      headers: { "content-type": "multipart/form-data; boundary=test" },
      body: {},
    },
  ]);
  await expect(new Interceptor().intercept(context, { handle: () => of(null) })).rejects.toThrow(
    'require uploadParsing: "interceptor"',
  );
});

it("accepts empty files at a zero-byte limit and enforces a zero-file limit", async () => {
  for (const filesLimit of [1, 0]) {
    const form = new FormData();
    form.append("file", new Blob([]), "empty.txt");
    const encoded = new Response(form);
    const request = createRequest(
      new Request("http://localhost/upload", {
        method: "POST",
        headers: { "content-type": encoded.headers.get("content-type")! },
        body: await encoded.arrayBuffer(),
      }),
    );
    if (filesLimit === 0)
      await expect(parseMemoryMultipart(request, 4096, 0, filesLimit)).rejects.toMatchObject({
        status: 413,
      });
    else {
      const parsed = await parseMemoryMultipart(request, 4096, 0, filesLimit);
      expect(parsed.body.file).toBeInstanceOf(File);
      expect((parsed.body.file as File).size).toBe(0);
    }
  }
});

it("applies local limits after guards without weakening global limits in memory or disk mode", async () => {
  const directory = await mkdtemp(join(tmpdir(), "native-local-limits-"));
  try {
    for (const disk of [false, true]) {
      const adapter = new NodeHttpAdapter({
        uploadParsing: "interceptor",
        uploadLimit: 4096,
        uploadFileLimit: 8,
        uploadFilesLimit: 2,
        ...(disk ? { uploadStorage: { directory } } : {}),
      });
      const app = await NestFactory.create(UploadModule, adapter, { logger: false });
      try {
        await app.init();
        const post = async (path: string, size: number, count = 1, allowed = true) => {
          const form = new FormData();
          form.append("note", "fixture");
          for (let i = 0; i < count; i++)
            form.append("file", new Blob(["x".repeat(size)]), `${i}.txt`);
          const encoded = new Response(form);
          const response = await adapter.fetch(
            new Request(`http://localhost/upload/${path}`, {
              method: "POST",
              headers: {
                "x-allow": allowed ? "yes" : "no",
                "content-type": encoded.headers.get("content-type")!,
              },
              body: await encoded.arrayBuffer(),
            }),
          );
          return { status: response.status, body: await response.json() };
        };
        expect(await post("small", 4)).toEqual({ status: 201, body: { size: 4, note: "fixture" } });
        expect((await post("small", 5)).status).toBe(413);
        expect((await post("small", 1, 2)).status).toBe(413);
        expect(await post("large", 8)).toEqual({ status: 201, body: { size: 8, disk } });
        expect((await post("large", 9)).status).toBe(413);
        expect((await post("small", 100, 1, false)).status).toBe(403);
        await app.close();
        expect(await readdir(directory)).toEqual([]);
      } finally {
        await app.close();
      }
    }
  } finally {
    await rm(directory, { recursive: true });
  }
});

it("stops reading an oversized memory file before consuming the complete multipart payload", async () => {
  let reads = 0;
  let cancelled = false;
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      reads++;
      if (reads === 1)
        controller.enqueue(
          encoder.encode(
            '--boundary\r\nContent-Disposition: form-data; name="file"; filename="large.txt"\r\n\r\n',
          ),
        );
      else if (reads < 100) controller.enqueue(encoder.encode("x".repeat(1024)));
      else {
        controller.enqueue(encoder.encode("\r\n--boundary--\r\n"));
        controller.close();
      }
    },
    cancel() {
      cancelled = true;
    },
  });
  const request = createRequest(
    new Request("http://localhost/upload", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=boundary" },
      body,
      duplex: "half",
    } as RequestInit),
  );
  await expect(parseMemoryMultipart(request, 1024 * 1024, 4)).rejects.toMatchObject({
    status: 413,
  });
  expect(reads).toBeLessThan(100);
  expect(cancelled).toBe(true);
});
