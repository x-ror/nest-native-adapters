import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), "nestjs-adapter-packed-"));
const tarballs = join(temporary, "tarballs");

try {
  await mkdir(tarballs, { recursive: true });
  for (const name of ["nestjs-adapter-node", "nestjs-adapter-bun"]) {
    execFileSync("pnpm", ["--filter", name, "pack", "--pack-destination", tarballs], {
      cwd: root,
      stdio: "inherit",
    });
  }

  const archives = await readdir(tarballs);
  const nodeArchive = archives.find((file) => file.startsWith("nestjs-adapter-node-"));
  const bunArchive = archives.find((file) => file.startsWith("nestjs-adapter-bun-"));
  assert.ok(nodeArchive, "Node adapter tarball was not created");
  assert.ok(bunArchive, "Bun adapter tarball was not created");

  for (const [common, core] of [
    ["10.1.3", "10.2.8"],
    ["11.0.0", "11.0.0"],
    ["11.2.7", "11.2.7"],
    ["12.1.2", "12.1.2"],
  ]) {
    const consumer = join(temporary, `consumer-${core}`);
    const uploadDirectory = join(consumer, "uploads");
    await mkdir(uploadDirectory, { recursive: true });
    const manifest = {
      private: true,
      type: "module",
      dependencies: {
        "@nestjs/common": common,
        "@nestjs/core": core,
        "nestjs-adapter-node": `file:${join(tarballs, nodeArchive)}`,
        "nestjs-adapter-bun": `file:${join(tarballs, bunArchive)}`,
        "reflect-metadata": common.startsWith("10.") ? "0.1.13" : "0.2.2",
        rxjs: "7.8.2",
        "class-validator": "0.15.1",
        "class-transformer": "0.5.1",
      },
      devDependencies: {
        "@types/bun": "1.4.2",
        "@types/node": "26.6.4",
        typescript: "7.0.2",
      },
    };
    await writeFile(join(consumer, "package.json"), JSON.stringify(manifest, null, 2));
    await writeFile(
      join(consumer, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            module: "NodeNext",
            moduleResolution: "NodeNext",
            types: ["node", "bun"],
            strict: true,
            experimentalDecorators: true,
            emitDecoratorMetadata: true,
            skipLibCheck: false,
            outDir: "dist",
          },
          include: ["consumer.ts"],
        },
        null,
        2,
      ),
    );
    await writeFile(
      join(consumer, "consumer.ts"),
      `import "reflect-metadata";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { Readable } from "node:stream";
import { createHmac, timingSafeEqual } from "node:crypto";
import { request as httpRequest } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import {
  Body, Catch, Controller, Get, Inject, Injectable, Module, Param, Post, Req, Scope, StreamableFile,
  UnauthorizedException, UploadedFile, UseFilters, UseGuards, UseInterceptors, ValidationPipe,
  Version, VersioningType,
  type ArgumentsHost, type CallHandler, type CanActivate, type ExceptionFilter, type ExecutionContext,
  type MiddlewareConsumer, type NestInterceptor, type NestMiddleware, type NestModule,
} from "@nestjs/common";
import { map } from "rxjs/operators";
import { Type } from "class-transformer";
import { IsInt, Min } from "class-validator";
import { NestFactory, REQUEST } from "@nestjs/core";
import { NodeHttpAdapter, FileInterceptor as NodeFileInterceptor } from "nestjs-adapter-node";
import type { DiskUploadedFileData, NativeAdapterOptions, NativeRequest, NativeResponse } from "nestjs-adapter-node";
import { BunHttpAdapter, FileInterceptor as BunFileInterceptor } from "nestjs-adapter-bun";
import type { UploadedFile as BunUploadedFile } from "nestjs-adapter-bun";

const uploadDirectory = ${JSON.stringify(uploadDirectory)};
const finished: string[] = [];
const scopedState = { created: 0, active: 0, maxActive: 0 };
@Injectable({ scope: Scope.REQUEST })
class RequestIdentity {
  readonly instanceId = ++scopedState.created;
  readonly requestId: string;
  readonly auth: string;
  readonly phases: string[] = [];
  constructor(@Inject(REQUEST) readonly request: NativeRequest) {
    const requestId = request.headers["x-request-id"];
    const auth = request.headers["x-auth"];
    assert.ok(typeof requestId === "string");
    assert.ok(typeof auth === "string");
    this.requestId = requestId;
    this.auth = auth;
  }
  record(phase: string, request: NativeRequest) {
    assert.equal(request, this.request, "All pipeline stages must share the injected REQUEST");
    assert.equal(request.headers["x-request-id"], this.requestId);
    assert.equal(request.headers["x-auth"], this.auth);
    this.phases.push(phase);
  }
  result() {
    return { requestId: this.requestId, auth: this.auth, instanceId: this.instanceId, phases: [...this.phases] };
  }
}
@Injectable()
class IdentityMiddleware implements NestMiddleware {
  constructor(private readonly identity: RequestIdentity) {}
  use(request: NativeRequest, _response: NativeResponse, next: () => void) {
    this.identity.record("middleware", request);
    next();
  }
}
@Injectable()
class IdentityGuard implements CanActivate {
  constructor(private readonly identity: RequestIdentity) {}
  canActivate(context: ExecutionContext) {
    this.identity.record("guard", context.switchToHttp().getRequest<NativeRequest>());
    if (this.identity.auth !== "yes") throw new UnauthorizedException();
    return true;
  }
}
@Injectable()
class IdentityInterceptor implements NestInterceptor {
  constructor(private readonly identity: RequestIdentity) {}
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<NativeRequest>();
    this.identity.record("interceptor-before", request);
    return next.handle().pipe(map(() => {
      this.identity.record("interceptor-after", request);
      return this.identity.result();
    }));
  }
}
@Catch(UnauthorizedException)
class IdentityFilter implements ExceptionFilter {
  constructor(private readonly identity: RequestIdentity) {}
  catch(_exception: UnauthorizedException, host: ArgumentsHost) {
    this.identity.record("filter", host.switchToHttp().getRequest<NativeRequest>());
    host.switchToHttp().getResponse<NativeResponse>().status(401).json(this.identity.result());
  }
}
@Controller("scoped")
@UseGuards(IdentityGuard)
@UseInterceptors(IdentityInterceptor)
@UseFilters(IdentityFilter)
class ScopedController {
  constructor(private readonly identity: RequestIdentity) {}
  @Get()
  async scoped() {
    this.identity.record("controller", this.identity.request);
    scopedState.active++;
    scopedState.maxActive = Math.max(scopedState.maxActive, scopedState.active);
    try {
      await delay(30);
      this.identity.record("controller-after-await", this.identity.request);
    } finally {
      scopedState.active--;
    }
  }
}
@Injectable()
class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    if (context.switchToHttp().getRequest<NativeRequest>().headers["x-auth"] !== "yes") {
      throw new UnauthorizedException();
    }
    return true;
  }
}
@Catch(UnauthorizedException)
class AuthFilter implements ExceptionFilter {
  catch(_exception: UnauthorizedException, host: ArgumentsHost) {
    host.switchToHttp().getResponse<NativeResponse>().status(401).json({ denied: true });
  }
}
class InputDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  count!: number;
}
const options: NativeAdapterOptions = {
  uploadFileLimit: 1024,
  uploadFilesLimit: 1,
  uploadStorage: { directory: uploadDirectory },
};
const describeDiskFile = (file: DiskUploadedFileData): number => file.size;
const describeBunUpload = (file: BunUploadedFile): number => file.size;
const describeRequest = (request: NativeRequest) => {
  const header: string | string[] | undefined = request.headers["x-custom"];
  const hostname: string | undefined = request.hostname;
  const file: number | undefined = request.file?.size;
  const files = request.files;
  return { header, hostname, file, files };
};
assert.equal(typeof describeRequest, "function");
assert.equal(typeof describeDiskFile, "function");
assert.equal(typeof describeBunUpload, "function");

@Controller()
class HealthController {
  @Get("health")
  health() {
    return { ok: true };
  }

  @Get("items/:id")
  @UseGuards(AuthGuard)
  item(@Param("id") id: string) {
    return { id };
  }

  @Post("validate")
  validate(@Body() body: InputDto) {
    assert.ok(body instanceof InputDto);
    return { count: body.count, type: typeof body.count };
  }

  @Get("versioned")
  @Version("2")
  versioned() {
    return { version: 2 };
  }

  @Get("stream")
  stream() {
    return new StreamableFile(Readable.from(["packed ", "stream"]));
  }

  @Post("upload")
  @UseInterceptors(
    process.argv[2] === "bun" ? BunFileInterceptor("file") : NodeFileInterceptor("file"),
  )
  async upload(@UploadedFile() file: DiskUploadedFileData, @Body() body: unknown) {
    return { originalname: file.originalname, content: await readFile(file.path, "utf8"), body };
  }
}
@Module({
  controllers: [HealthController, ScopedController],
  providers: [AuthGuard, RequestIdentity, IdentityMiddleware, IdentityGuard, IdentityInterceptor, IdentityFilter],
})
class HealthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply((request: NativeRequest, response: NativeResponse, next: () => void) => {
      assert.equal(request.baseUrl, "");
      response.raw.once("finish", () => finished.push(request.path));
      response.cookie("packed", "works", { httpOnly: true });
      request.secret = "packed-secret";
      response.cookie("signed", "works", { signed: true, httpOnly: true });
      next();
    }).forRoutes("*");
    consumer.apply(IdentityMiddleware).forRoutes(ScopedController);
  }
}

const adapter =
  process.argv[2] === "bun" ? new BunHttpAdapter(options) : new NodeHttpAdapter(options);
const app = await NestFactory.create(HealthModule, adapter, { logger: false });
try {
  app.setGlobalPrefix("api");
  app.enableVersioning({ type: VersioningType.HEADER, header: "x-version" });
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.useGlobalFilters(new AuthFilter());
  app.enableCors();
  await app.listen(0, "127.0.0.1");
  const base = \`\${await app.getUrl()}/api\`;
  const response = await fetch(\`\${base}/health\`);
  assert.equal(response.status, 200);
  assert.ok(response.headers.get("set-cookie")?.includes("packed=works; Path=/; HttpOnly"));
  assert.ok(response.headers.get("set-cookie")?.includes("signed=s%3Aworks."));
  assert.deepEqual(await response.json(), { ok: true });

  const form = new FormData();
  form.append("note", "packed");
  form.append("file", new Blob(["tarball upload works"]), "packed.txt");
  const upload = await fetch(\`\${base}/upload\`, { method: "POST", body: form });
  assert.equal(upload.status, 201);
  assert.deepEqual(await upload.json(), {
    originalname: "packed.txt",
    content: "tarball upload works",
    body: { note: "packed" },
  });
  for (let attempt = 0; attempt < 100 && (await readdir(uploadDirectory)).length; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.deepEqual(await readdir(uploadDirectory), []);
  for (let attempt = 0; attempt < 100 && finished.length < 2; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.deepEqual(finished, ["/api/health", "/api/upload"]);
  const denied = await fetch(\`\${base}/items/42\`);
  assert.equal(denied.status, 401);
  assert.deepEqual(await denied.json(), { denied: true });
  const item = await fetch(\`\${base}/items/42\`, { headers: { "x-auth": "yes" } });
  assert.equal(item.status, 200);
  assert.deepEqual(await item.json(), { id: "42" });
  for (const [count, status] of [["3", 201], ["bad", 400]] as const) {
    const validated = await fetch(\`\${base}/validate\`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ count }),
    });
    assert.equal(validated.status, status);
    const body = await validated.json();
    if (status === 201) assert.deepEqual(body, { count: 3, type: "number" });
    else assert.equal(body.statusCode, 400);
  }
  const versioned = await fetch(\`\${base}/versioned\`, { headers: { "x-version": "2" } });
  assert.equal(versioned.status, 200);
  assert.deepEqual(await versioned.json(), { version: 2 });
  const wrongVersion = await fetch(\`\${base}/versioned\`, { headers: { "x-version": "1" } });
  assert.equal(wrongVersion.status, 404);
  await wrongVersion.text();
  const streamed = await fetch(\`\${base}/stream\`);
  assert.equal(streamed.status, 200);
  assert.equal(await streamed.text(), "packed stream");
  const head = await fetch(\`\${base}/health\`, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  const cors = await fetch(\`\${base}/health\`, {
    method: "OPTIONS",
    headers: { origin: "https://fixture.test", "access-control-request-method": "GET" },
  });
  assert.equal(cors.status, 204);
  assert.equal(cors.headers.get("access-control-allow-origin"), "*");
  const scopedIds = new Set<number>();
  const scoped = async (requestId: string, auth = "yes") => {
    const response = await fetch(\`\${base}/scoped\`, {
      headers: { "x-request-id": requestId, "x-auth": auth },
    });
    assert.equal(response.status, auth === "yes" ? 200 : 401);
    const body = await response.json();
    assert.equal(body.requestId, requestId);
    assert.equal(body.auth, auth);
    assert.ok(Number.isSafeInteger(body.instanceId));
    assert.ok(!scopedIds.has(body.instanceId), "A provider instance must not survive into another request");
    scopedIds.add(body.instanceId);
    assert.deepEqual(body.phases, auth === "yes"
      ? ["middleware", "guard", "interceptor-before", "controller", "controller-after-await", "interceptor-after"]
      : ["middleware", "guard", "filter"]);
  };
  await scoped("sequential-1");
  await scoped("sequential-2");
  await Promise.all(Array.from({ length: 12 }, (_, index) =>
    scoped(\`parallel-\${index}\`, index % 3 ? "yes" : "no")));
  assert.ok(scopedState.maxActive > 1, "Request-scoped handlers must overlap");
  assert.equal(scopedState.active, 0);
  assert.equal(scopedState.created, 14, "Middleware, guard, interceptor, filter and controller share one scope");
} finally {
  await app.close();
}
const webhookSecret = "fixture-only-webhook-secret";
const sign = (bytes: Uint8Array) => createHmac("sha256", webhookSecret).update(bytes).digest("hex");
let acceptedWebhooks = 0;
@Injectable()
class SignatureGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<NativeRequest>();
    const signature = request.headers["x-signature"];
    if (!Buffer.isBuffer(request.rawBody) || typeof signature !== "string" ||
        !/^[a-f0-9]{64}$/.test(signature) ||
        !timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(sign(request.rawBody), "hex"))) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
@Controller("webhook")
@UseGuards(SignatureGuard)
class WebhookController {
  @Post()
  receive(@Req() request: NativeRequest, @Body() body: unknown) {
    assert.ok(Buffer.isBuffer(request.rawBody));
    acceptedWebhooks++;
    return {
      raw: request.rawBody.toString("hex"),
      body: Buffer.isBuffer(body) ? body.toString("hex") : body,
    };
  }
}
@Module({ controllers: [WebhookController], providers: [SignatureGuard] })
class WebhookModule {}
const webhookAdapter = process.argv[2] === "bun"
  ? new BunHttpAdapter({ bodyLimit: 256 })
  : new NodeHttpAdapter({ bodyLimit: 256 });
const webhookApp = await NestFactory.create(WebhookModule, webhookAdapter, {
  logger: false, rawBody: true,
});
try {
  webhookAdapter.useBodyParser("json", true, { type: "application/vnd.fixture+json" });
  webhookAdapter.useBodyParser("raw", true);
  await webhookApp.listen(0, "127.0.0.1");
  const endpoint = \`\${await webhookApp.getUrl()}/webhook\`;
  const send = async (bytes: Buffer, signature = sign(bytes), type = "application/json") => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": type, "x-signature": signature },
      body: new Uint8Array(bytes),
    });
    return { status: response.status, body: await response.json() };
  };
  const text = String.fromCodePoint(0x41f, 0x440, 0x438, 0x432, 0x456, 0x442, 0x1f680);
  const payload = Buffer.from(JSON.stringify({ text, value: 7 }, null, 2).replaceAll("\\n", "\\r\\n") + "\\r\\n");
  const parsed = JSON.parse(payload.toString("utf8"));
  const expected = { raw: payload.toString("hex"), body: parsed };
  assert.deepEqual(await send(payload), { status: 201, body: expected });
  assert.equal((await send(payload, sign(Buffer.from(JSON.stringify(parsed))))).status, 401,
    "Signing reserialized JSON must not authenticate the original bytes");
  for (const signature of ["", "invalid", "0".repeat(64)]) {
    assert.equal((await send(payload, signature)).status, 401);
  }
  assert.deepEqual(await send(payload, sign(payload), "application/vnd.fixture+json"),
    { status: 201, body: expected });
  const binary = Buffer.from([0, 255, 128, 13, 10, 0, 42]);
  assert.deepEqual(await send(binary, sign(binary), "application/octet-stream"), {
    status: 201, body: { raw: binary.toString("hex"), body: binary.toString("hex") },
  });
  const chunked = await new Promise<{ status: number | undefined; body: unknown }>((resolve, reject) => {
    const request = httpRequest(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", "x-signature": sign(payload) },
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("error", reject);
      response.on("end", () => {
        try {
          resolve({ status: response.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) });
        } catch (error) { reject(error); }
      });
    });
    request.on("error", reject);
    void (async () => {
      for (const byte of payload) {
        request.write(Buffer.from([byte]));
        await delay(1);
      }
      request.end();
    })().catch((error: Error) => request.destroy(error));
  });
  assert.deepEqual(chunked, { status: 201, body: expected },
    "Chunk boundaries inside multibyte UTF-8 must not alter rawBody");
  const atLimit = Buffer.from(JSON.stringify({ text: "a".repeat(245) }));
  assert.equal(atLimit.length, 256);
  assert.equal((await send(atLimit)).status, 201);
  const beforeErrors = acceptedWebhooks;
  assert.equal((await send(Buffer.concat([atLimit, Buffer.from(" ") ]))).status, 413);
  const multibyteLimit = Buffer.from(JSON.stringify({ text: text.repeat(20) }));
  assert.ok(multibyteLimit.toString("utf8").length < 256);
  assert.ok(multibyteLimit.length > 256);
  assert.equal((await send(multibyteLimit)).status, 413, "Body limits count bytes, not characters");
  assert.equal((await send(Buffer.from("{"))).status, 400);
  assert.equal(acceptedWebhooks, beforeErrors, "Parser failures must not invoke the webhook");
  assert.deepEqual(await send(payload), { status: 201, body: expected },
    "A valid webhook must still succeed after parser failures");
  await Promise.all(Array.from({ length: 8 }, async (_, index) => {
    const bytes = Buffer.from(JSON.stringify({ text, index }, null, index % 3));
    assert.deepEqual(await send(bytes), {
      status: 201, body: { raw: bytes.toString("hex"), body: { text, index } },
    });
  }));
} finally {
  await webhookApp.close();
}
console.log(\`packed package smoke passed on \${process.argv[2]} / Nest ${core}\`);
`,
    );

    execFileSync("npm", ["install", "--no-audit", "--no-fund"], {
      cwd: consumer,
      stdio: "inherit",
    });
    execFileSync(join(consumer, "node_modules/.bin/tsc"), ["--project", "tsconfig.json"], {
      cwd: consumer,
      stdio: "inherit",
    });
    execFileSync("node", ["dist/consumer.js", "node"], {
      cwd: consumer,
      stdio: "inherit",
      timeout: 60000,
    });
    execFileSync("bun", ["dist/consumer.js", "bun"], {
      cwd: consumer,
      stdio: "inherit",
      timeout: 60000,
    });
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
