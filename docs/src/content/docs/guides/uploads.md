---
title: Uploads
description: Multipart uploads in memory or on disk, streaming limits and file filters.
---

By default the adapters hold multipart files in memory. Without an upload
interceptor, files are native `File` values on `@Body()`. With
`FileInterceptor`, `FilesInterceptor`, `FileFieldsInterceptor` or
`AnyFilesInterceptor` (imported from the adapter package), files reach
`@UploadedFile()` / `@UploadedFiles()` in Multer's memory-storage shape
(`originalname`, `mimetype`, `size`, `buffer`).

For large uploads, opt into temporary disk-backed streaming:

```ts
new NodeHttpAdapter({
  uploadLimit: 10 * 1024 * 1024,
  uploadFileLimit: 5 * 1024 * 1024,
  uploadFilesLimit: 4,
  uploadStorage: { directory: "/var/tmp/my-app-uploads" },
});
```

Use the same options with `BunHttpAdapter`. The configured directory must
already exist and be writable. The adapter parses multipart fields as usual
and exposes files through `@UploadedFile()` / `@UploadedFiles()` as
`DiskUploadedFileData` (`path`, `destination`, `filename`, and metadata, but
no `buffer`). It removes the temporary files after the response completes,
including when a guard or validator rejects the request or the handler throws.
Move or copy a file in the controller if it must persist.

- `uploadLimit` limits the complete multipart payload in both modes and
  defaults to `bodyLimit`. `uploadFileLimit` defaults to `uploadLimit`.
  `uploadFilesLimit` is unlimited when omitted.
- A request over a size or count limit gets `413`. Truncated multipart data
  gets `400`.
- In disk mode the adapter enforces limits while streaming. In memory mode it
  checks per-file limits after buffering at most `uploadLimit` bytes.
- Parsing happens before guards, so a rejected request can already have files
  on disk until its response completes.
- With Nest's `rawBody` option, uploads stay in memory so that `rawBody` can
  hold the complete request.

### Per-interceptor streaming limits

Opt in to parsing multipart inside upload interceptors, after guards:

```ts
new NodeHttpAdapter({
  uploadParsing: "interceptor",
  uploadLimit: 10 * 1024 * 1024,
});

@Post("avatar")
@UseInterceptors(FileInterceptor("avatar", {
  limits: { fileSize: 256 * 1024, files: 1 },
}))
upload(@UploadedFile() file: UploadedFile) {
  return { size: file.size };
}
```

The same mode works on Bun and with optional `uploadStorage`. Both storage
modes enforce `limits.fileSize` (bytes per file) and `limits.files` (total file
count) during streaming, returning `413` without waiting for the complete
payload. Local limits cannot increase the adapter's global limits.
Values must be nonnegative safe integers; zero permits only empty files or
no files, respectively.

Options occupy the second argument of `FileInterceptor`,
`FileFieldsInterceptor` and `AnyFilesInterceptor`, and the third argument of
`FilesInterceptor(fieldName, maxCount, options)`. `maxCount` and unexpected-field
checks retain their existing behavior after parsing. These options are typed as
`UploadInterceptorOptions`; other Multer limits are not supported.

In this opt-in mode, multipart bodies and files are unavailable to middleware,
guards and interceptors running before the upload interceptor. Every route
that needs multipart `@Body()` must install an upload interceptor, even without
local limits. JSON and URL-encoded parsing are unchanged. The mode cannot be
combined with Nest's `rawBody: true` option and fails at startup if it is.
Using local limits in the default middleware-parsing mode throws an explicit
configuration error on multipart requests; it does not claim to enforce them
retroactively. The default mode and existing interceptor calls are unchanged.

### Filtering uploads

All four upload interceptors accept a callback-style `fileFilter` in the same
options object. Like local streaming limits, this requires
`uploadParsing: "interceptor"`.

```ts
FileInterceptor("avatar", {
  fileFilter(request, file, callback) {
    callback(null, file.mimetype === "image/png");
  },
});
```

The filter runs before writing the file to disk or buffering its contents in
memory. `callback(null, true)` accepts it; `callback(null, false)` drains and
skips it. A skipped file is absent from `@UploadedFile()` / `@UploadedFiles()`.
Callback errors and thrown errors abort parsing, preserve Nest HTTP exceptions,
and clean up already accepted temporary files. A plain `Error` produces HTTP
500 through Nest's usual exception handling.

Filters may call back asynchronously, must call back with a boolean decision
on success, and should do so exactly once. The parser preserves file order
even when decisions finish out of order. Metadata (`UploadFileMetadata`)
includes `fieldname`, `originalname`, `encoding` and `mimetype`, not a buffer
or disk path. `request.body` contains fields received so far, so fields sent
after the file may not yet be available. `UploadFileFilter` is exported by
both packages.

Client disconnection cancels streaming multipart parsing and removes temporary
upload files, including while an asynchronous filter decision is pending.
Callbacks arriving after cancellation are ignored. This does not cancel work
started by your filter; use `request.raw.signal` to stop that work.

Skipped files still count toward `limits.files` and the total payload limit;
their contents are not subject to the accepted-file size limit. MIME types
and names are supplied by the client: filtering them does not validate file
contents or guarantee their safety.
