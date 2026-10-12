import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Transform, Readable, Writable } from "node:stream";
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
  fileSizeLimit = limit,
  filesLimit?: number,
): Promise<ParsedDiskMultipart> {
  return parseMultipart(request, limit, { directory: rootDirectory }, fileSizeLimit, filesLimit);
}

export async function parseMemoryMultipart(
  request: NativeRequest,
  limit: number,
  fileSizeLimit = limit,
  filesLimit?: number,
): Promise<ParsedDiskMultipart> {
  return parseMultipart(request, limit, undefined, fileSizeLimit, filesLimit);
}

async function parseMultipart(
  request: NativeRequest,
  limit: number,
  storage: { directory?: string } | undefined,
  fileSizeLimit: number,
  filesLimit?: number,
): Promise<ParsedDiskMultipart> {
  const bodyStream = request.raw.body;
  const headers = new Headers(request.raw.headers);
  if (!bodyStream) return { body: Object.create(null), files: [], cleanup: async () => {} };

  let destination: string | undefined;
  if (storage) {
    try {
      destination = await mkdtemp(join(storage.directory ?? tmpdir(), "nestjs-upload-"));
    } catch (error) {
      throw new Error("Could not create temporary upload directory.", { cause: error });
    }
  }

  let cleaned = false;
  const cleanup = async (): Promise<void> => {
    if (cleaned) return;
    cleaned = true;
    if (destination) await rm(destination, { recursive: true });
  };
  const body = Object.create(null) as Record<string, unknown>;
  const files: DiskUploadFile[] = [];
  let writeError: unknown;
  let limitError: PayloadTooLargeException | undefined;
  let parser: ReturnType<typeof Busboy>;
  try {
    parser = Busboy({
      headers: Object.fromEntries(headers) as Record<string, string>,
      limits: {
        fieldSize: limit,
        fileSize: fileSizeLimit < Number.MAX_SAFE_INTEGER ? fileSizeLimit + 1 : fileSizeLimit,
        ...(filesLimit === undefined ? {} : { files: filesLimit }),
      },
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
  parser.on("filesLimit", () => {
    limitError ??= new PayloadTooLargeException();
    queueMicrotask(() => parser.destroy(limitError));
  });
  parser.on("file", (fieldname, stream, info) => {
    const filename = randomUUID();
    const file: DiskUploadFile | undefined = destination
      ? {
          fieldname,
          originalname: info.filename ?? "",
          encoding: info.encoding,
          mimetype: info.mimeType.split(";")[0]!,
          size: 0,
          destination,
          filename,
          path: join(destination, filename),
        }
      : undefined;
    if (file) files.push(file);
    let size = 0;
    const chunks: Buffer[] = [];
    const counter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        size += chunk.length;
        if (size > fileSizeLimit) {
          limitError ??= new PayloadTooLargeException();
          callback(limitError);
          return;
        }
        callback(null, chunk);
      },
    });
    const destinationStream = file
      ? createWriteStream(file.path, { flags: "wx", mode: 0o600 })
      : new Writable({
          write(chunk: Buffer, _encoding, callback) {
            chunks.push(chunk);
            callback();
          },
        });
    // Observe disk errors before pipeline propagates them back to the source.
    // Parser errors already present on the source must stay client errors.
    destinationStream.on("error", (error) => {
      if (!stream.errored && !counter.errored) writeError ??= error;
    });
    const write = pipeline(stream, counter, destinationStream).then(() => {
      if (file) file.size = size;
      else
        assignFormValue(
          body,
          formFieldPath(fieldname),
          new File([Buffer.concat(chunks, size)], info.filename ?? "", { type: info.mimeType }),
        );
    });
    fileWrites.push(write);
    void write.catch((error: unknown) => {
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
    if (limitError) throw limitError;
    return { body, files, cleanup };
  } catch (error) {
    await Promise.allSettled(fileWrites);
    await cleanup();
    if (limitError) throw limitError;
    if (error instanceof PayloadTooLargeException) throw error;
    if (writeError !== undefined) throw writeError;
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException("Invalid multipart form data", { cause: error });
  }
}
