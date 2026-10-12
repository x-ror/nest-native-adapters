import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Transform, Readable, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import Busboy from "busboy";
import type { UploadFileFilter } from "./uploads.js";
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
  fileFilter?: UploadFileFilter,
): Promise<ParsedDiskMultipart> {
  return parseMultipart(
    request,
    limit,
    { directory: rootDirectory },
    fileSizeLimit,
    filesLimit,
    fileFilter,
  );
}

export async function parseMemoryMultipart(
  request: NativeRequest,
  limit: number,
  fileSizeLimit = limit,
  filesLimit?: number,
  fileFilter?: UploadFileFilter,
): Promise<ParsedDiskMultipart> {
  return parseMultipart(request, limit, undefined, fileSizeLimit, filesLimit, fileFilter);
}

async function parseMultipart(
  request: NativeRequest,
  limit: number,
  storage: { directory?: string } | undefined,
  fileSizeLimit: number,
  filesLimit?: number,
  fileFilter?: UploadFileFilter,
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
  if (fileFilter) request.body = body;
  const files: DiskUploadFile[] = [];
  let writeError: unknown;
  let filterError: Error | undefined;
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
  const collectedFiles: (() => void)[] = [];
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
    // A filter can fail before a storage pipeline has attached its error listeners.
    stream.on("error", (error) => parser.destroy(error));
    const index = collectedFiles.length;
    collectedFiles.push(() => {});
    const metadata = {
      fieldname,
      originalname: info.filename ?? "",
      encoding: info.encoding,
      mimetype: info.mimeType.split(";")[0]!,
    };
    const decision = fileFilter
      ? new Promise<boolean>((resolve, reject) => {
          let called = false;
          const onError = (error: Error) => reject(error);
          stream.once("error", onError);
          const callback = (error: Error | null, accept?: boolean) => {
            if (called) return;
            called = true;
            stream.off("error", onError);
            if (error) {
              filterError = error;
              reject(error);
            } else if (typeof accept !== "boolean") {
              filterError = new TypeError(
                "fileFilter callback must provide a boolean acceptance value.",
              );
              reject(filterError);
            } else resolve(accept);
          };
          try {
            fileFilter(request, metadata, callback);
          } catch (error) {
            callback(
              error instanceof Error ? error : new Error("fileFilter failed", { cause: error }),
            );
          }
        })
      : Promise.resolve(true);
    const write = decision.then(async (accept) => {
      if (!accept) {
        await pipeline(
          stream,
          new Writable({
            write(_chunk, _encoding, callback) {
              callback();
            },
          }),
        );
        return;
      }
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
      await pipeline(stream, counter, destinationStream);
      if (file) {
        file.size = size;
        collectedFiles[index] = () => {
          files.push(file);
        };
      } else {
        const value = new File([Buffer.concat(chunks, size)], info.filename ?? "", {
          type: info.mimeType,
        });
        collectedFiles[index] = () => assignFormValue(body, formFieldPath(fieldname), value);
      }
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
    for (const collect of collectedFiles) collect();
    return { body, files, cleanup };
  } catch (error) {
    await Promise.allSettled(fileWrites);
    await cleanup();
    if (filterError) throw filterError;
    if (limitError) throw limitError;
    if (error instanceof PayloadTooLargeException) throw error;
    if (writeError !== undefined) throw writeError;
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException("Invalid multipart form data", { cause: error });
  }
}
