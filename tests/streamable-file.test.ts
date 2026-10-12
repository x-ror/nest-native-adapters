import { Readable } from "node:stream";
import { StreamableFile } from "@nestjs/common";
import { expect, it } from "vite-plus/test";
import { NativeResponse } from "../shared/response.js";

it("uses StreamableFile metadata when response headers are absent, including zero length", async () => {
  const response = new NativeResponse("GET").send(
    new StreamableFile(Buffer.alloc(0), {
      type: "text/plain",
      disposition: 'attachment; filename="empty.txt"',
    }),
  );
  const result = await response.done;
  expect(result.headers.get("content-type")).toBe("text/plain");
  expect(result.headers.get("content-disposition")).toBe('attachment; filename="empty.txt"');
  expect(result.headers.get("content-length")).toBe("0");
  expect(await result.text()).toBe("");
});

it("preserves explicit response headers over StreamableFile metadata", async () => {
  const response = new NativeResponse("GET")
    .setHeader("Content-Type", "text/custom")
    .setHeader("Content-Disposition", 'inline; filename="custom.txt"')
    .setHeader("Content-Length", "4")
    .send(
      new StreamableFile(Buffer.from("data"), {
        type: "application/octet-stream",
        disposition: 'attachment; filename="default.bin"',
        length: 99,
      }),
    );
  const result = await response.done;
  expect(result.headers.get("content-type")).toBe("text/custom");
  expect(result.headers.get("content-disposition")).toBe('inline; filename="custom.txt"');
  expect(result.headers.get("content-length")).toBe("4");
  expect(await result.text()).toBe("data");
});

it("destroys a StreamableFile source without reading it for HEAD", async () => {
  let reads = 0;
  const stream = new Readable({
    read() {
      reads++;
      this.push("data");
      this.push(null);
    },
  });
  const response = new NativeResponse("HEAD").send(
    new StreamableFile(stream, { type: "text/plain", length: 4 }),
  );
  const result = await response.done;
  expect(await result.text()).toBe("");
  expect(result.headers.get("content-length")).toBe("4");
  expect(stream.destroyed).toBe(true);
  expect(reads).toBe(0);
});
