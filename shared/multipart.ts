import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Transform, Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import Busboy from "busboy";
import { BadRequestException, PayloadTooLargeException } from "@nestjs/common";
import {
  assignFormValue,
  formFieldPath,
  type DiskUploadFile,
  type NativeRequest,
} from "./request.js";

export interface ParsedDiskMultipart {
  body: Record<string, unknown>;
  files: DiskUploadFile[];
  cleanup: () => Promise<void>;
}

export async function parseDiskMultipart(
  request: NativeRequest,
  limit: number,
  rootDirectory?: string,
): Promise<ParsedDiskMultipart> {
  const bodyStream = request.raw.body;
  const headers = new Headers(request.raw.headers);
  if (!bodyStream) return { body: Object.create(null), files: [], cleanup: async () => {} };

  let destination: string;
  try {
    destination = await mkdtemp(join(rootDirectory ?? tmpdir(), "nestjs-upload-"));
  } catch (error) {
    throw new Error("Could not create temporary upload directory.", { cause: error });
  }

  let cleaned = false;
  const cleanup = async (): Promise<void> => {
    if (cleaned) return;
    cleaned = true;
    await rm(destination, { recursive: true });
  };
  const body = Object.create(null) as Record<string, unknown>;
  const files: DiskUploadFile[] = [];
  let writeError: unknown;
  let parser: ReturnType<typeof Busboy>;
  try {
    parser = Busboy({
      headers: Object.fromEntries(headers) as Record<string, string>,
      limits: { fieldSize: limit, fileSize: limit },
    });
  } catch (error) {
    await cleanup();
    throw new BadRequestException("Invalid multipart form data", { cause: error });
  }

  const fileWrites: Promise<void>[] = [];
  parser.on("field", (name, value, info) => {
    if (info.nameTruncated || info.valueTruncated) {
      parser.destroy(new PayloadTooLargeException());
      return;
    }
    try {
      assignFormValue(body, formFieldPath(name), value);
    } catch (error) {
      parser.destroy(error as Error);
    }
  });
  parser.on("file", (fieldname, stream, info) => {
    const filename = randomUUID();
    const path = join(destination, filename);
    const file: DiskUploadFile = {
      fieldname,
      originalname: info.filename ?? "",
      encoding: info.encoding,
      mimetype: info.mimeType.split(";")[0]!,
      size: 0,
      destination,
      filename,
      path,
    };
    files.push(file);
    let size = 0;
    const counter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        size += chunk.length;
        callback(null, chunk);
      },
    });
    stream.once("limit", () => parser.destroy(new PayloadTooLargeException()));
    const write = pipeline(
      stream,
      counter,
      createWriteStream(path, { flags: "wx", mode: 0o600 }),
    ).then(() => {
      file.size = size;
    });
    fileWrites.push(write);
    void write.catch((error: unknown) => {
      writeError ??= error;
      parser.destroy(error instanceof Error ? error : new Error("Upload file write failed."));
    });
  });

  let requestSize = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      requestSize += chunk.length;
      if (requestSize > limit) callback(new PayloadTooLargeException());
      else callback(null, chunk);
    },
  });
  try {
    await pipeline(
      Readable.fromWeb(
        bodyStream as unknown as import("node:stream/web").ReadableStream<Uint8Array>,
      ),
      limiter,
      parser,
    );
    await Promise.all(fileWrites);
    return { body, files, cleanup };
  } catch (error) {
    const writeResults = await Promise.allSettled(fileWrites);
    const failedWrite = writeResults.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (failedWrite) writeError ??= failedWrite.reason;
    await cleanup();
    if (error instanceof PayloadTooLargeException) throw error;
    if (writeError !== undefined) throw writeError;
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException("Invalid multipart form data", { cause: error });
  }
}
