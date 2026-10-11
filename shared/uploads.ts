import {
  BadRequestException,
  mixin,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
  type Type,
} from "@nestjs/common";
import type { DiskUploadFile } from "./request.js";

/** An uploaded file in the shape Multer's memory storage produces. */
export interface UploadedFileData {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}
export type DiskUploadedFileData = DiskUploadFile;
export type UploadedFile = UploadedFileData | DiskUploadedFileData;
interface UploadRequest {
  body?: unknown;
  file?: UploadedFile;
  files?: UploadedFile[] | Record<string, UploadedFile[]>;
  uploads?: DiskUploadFile[];
}

// Moves the files of one top-level field out of the parsed multipart body.
async function takeFiles(
  request: UploadRequest,
  body: Record<string, unknown>,
  field: string,
): Promise<UploadedFile[]> {
  const diskFiles = request.uploads?.filter((file) => file.fieldname === field) ?? [];
  const value = body[field];
  const entries = Array.isArray(value) ? value : [value];
  const files = entries.filter((entry): entry is File => entry instanceof File);
  if (!files.length) return diskFiles;
  const rest = entries.filter((entry) => !(entry instanceof File));
  if (rest.length) body[field] = rest.length === 1 ? rest[0] : rest;
  else delete body[field];
  return [
    ...diskFiles,
    ...(await Promise.all(
      files.map(async (file) => ({
        fieldname: field,
        originalname: file.name,
        encoding: "7bit",
        mimetype: file.type.split(";")[0]!,
        size: file.size,
        buffer: Buffer.from(await file.arrayBuffer()),
      })),
    )),
  ];
}

function fileFields(request: UploadRequest, body: Record<string, unknown>): string[] {
  const fields = Object.keys(body).filter((field) =>
    ([] as unknown[]).concat(body[field]).some((entry) => entry instanceof File),
  );
  for (const file of request.uploads ?? []) {
    if (!fields.includes(file.fieldname)) fields.push(file.fieldname);
  }
  return fields;
}

function uploadInterceptor(
  collect: (request: UploadRequest, body: Record<string, unknown>) => Promise<void>,
): Type<NestInterceptor> {
  return mixin(
    class {
      async intercept(context: ExecutionContext, next: CallHandler) {
        const request = context.switchToHttp().getRequest<UploadRequest>();
        const body = request.body;
        if (body !== null && typeof body === "object")
          await collect(request, body as Record<string, unknown>);
        return next.handle();
      }
    },
  );
}

function reject(request: UploadRequest, body: Record<string, unknown>, allowed: string[]): void {
  const unexpected = fileFields(request, body).find((field) => !allowed.includes(field));
  if (unexpected !== undefined) throw new BadRequestException(`Unexpected field - ${unexpected}`);
}

function validateMaxCount(maxCount: number): void {
  if (maxCount !== Infinity && (!Number.isSafeInteger(maxCount) || maxCount < 0)) {
    throw new TypeError("maxCount must be a nonnegative integer or Infinity.");
  }
}

/** Like Multer's `FileInterceptor`: one file from `fieldName` for `@UploadedFile()`. */
export function FileInterceptor(fieldName: string): Type<NestInterceptor> {
  return uploadInterceptor(async (request, body) => {
    reject(request, body, [fieldName]);
    const files = await takeFiles(request, body, fieldName);
    if (files.length > 1) throw new BadRequestException(`Unexpected field - ${fieldName}`);
    request.file = files[0];
  });
}

/** Like Multer's `FilesInterceptor`: every file from `fieldName` for `@UploadedFiles()`. */
export function FilesInterceptor(fieldName: string, maxCount = Infinity): Type<NestInterceptor> {
  validateMaxCount(maxCount);
  return uploadInterceptor(async (request, body) => {
    reject(request, body, [fieldName]);
    const files = await takeFiles(request, body, fieldName);
    if (files.length > maxCount) throw new BadRequestException(`Too many files - ${fieldName}`);
    request.files = files;
  });
}

/** Like Multer's `FileFieldsInterceptor`: `@UploadedFiles()` gets files grouped by field. */
export function FileFieldsInterceptor(
  fields: { name: string; maxCount?: number }[],
): Type<NestInterceptor> {
  for (const { maxCount = Infinity } of fields) validateMaxCount(maxCount);
  return uploadInterceptor(async (request, body) => {
    reject(
      request,
      body,
      fields.map((field) => field.name),
    );
    const grouped: Record<string, UploadedFile[]> = {};
    for (const { name, maxCount = Infinity } of fields) {
      const files = await takeFiles(request, body, name);
      if (files.length > maxCount) throw new BadRequestException(`Too many files - ${name}`);
      if (files.length) grouped[name] = files;
    }
    request.files = grouped;
  });
}

/** Like Multer's `AnyFilesInterceptor`: every uploaded file, whatever its field. */
export function AnyFilesInterceptor(): Type<NestInterceptor> {
  return uploadInterceptor(async (request, body) => {
    const files: UploadedFile[] = [];
    for (const field of fileFields(request, body))
      files.push(...(await takeFiles(request, body, field)));
    request.files = files;
  });
}
