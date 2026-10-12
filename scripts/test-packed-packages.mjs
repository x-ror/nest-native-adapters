import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), "nestjs-adapter-packed-"));
const tarballs = join(temporary, "tarballs");
const tlsDirectory = mkdtempSync(join(tmpdir(), "nestjs-adapter-packed-tls-"));

try {
  await mkdir(tarballs, { recursive: true });
  const tlsKey = join(tlsDirectory, "key.pem");
  const tlsCert = join(tlsDirectory, "cert.pem");
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-days",
      "1",
      "-subj",
      "/CN=localhost",
      "-keyout",
      tlsKey,
      "-out",
      tlsCert,
    ],
    { stdio: "ignore" },
  );
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
    const staticDirectory = join(consumer, "static");
    const viewsDirectory = join(consumer, "views");
    await mkdir(uploadDirectory, { recursive: true });
    await mkdir(join(staticDirectory, "docs"), { recursive: true });
    await writeFile(join(staticDirectory, "sample.txt"), "0123456789");
    await writeFile(join(staticDirectory, ".hidden"), "hidden");
    await writeFile(join(staticDirectory, "docs", "index.html"), "<h1>fixture</h1>");
    await mkdir(viewsDirectory);
    await writeFile(join(viewsDirectory, "hello.ejs"), "<h1>Hello <%= name %></h1>");
    await writeFile(join(viewsDirectory, "broken.ejs"), "<%= missingVariable %>");
    const manifest = {
      private: true,
      type: "module",
      dependencies: {
        "@nestjs/common": common,
        "@nestjs/core": core,
        "@nestjs/platform-ws": core,
        "@nestjs/platform-socket.io": core,
        "@nestjs/websockets": core,
        "nestjs-adapter-node": `file:${join(tarballs, nodeArchive)}`,
        "nestjs-adapter-bun": `file:${join(tarballs, bunArchive)}`,
        "reflect-metadata": common.startsWith("10.") ? "0.1.13" : "0.2.2",
        rxjs: "7.8.2",
        ws: "8.18.0",
        "class-validator": "0.15.1",
        "class-transformer": "0.5.1",
        "socket.io-client": "4.8.4",
        ejs: "3.1.10",
      },
      devDependencies: {
        "@types/bun": "1.4.2",
        "@types/node": "26.6.4",
        "@types/ws": "8.5.14",
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
import { WebSocket } from "ws";
import { io as connectSocket } from "socket.io-client";
import { createHmac, timingSafeEqual } from "node:crypto";
import { request as httpRequest } from "node:http";
import { get as httpsGet } from "node:https";
import { setTimeout as delay } from "node:timers/promises";
import {
  BadRequestException, Body, Catch, ClassSerializerInterceptor, ConflictException, Controller, Get, HostParam, HttpCode, HttpException, Inject,
  Injectable, MaxFileSizeValidator, Module, Options, Param, ParseFilePipe, Post, Redirect, Render, Req, Res,
  RequestMethod, Scope, Sse, StreamableFile,
  UnauthorizedException, UploadedFile, UploadedFiles, UseFilters, UseGuards, UseInterceptors, ValidationPipe,
  VERSION_NEUTRAL, Version, VersioningType,
  type ArgumentsHost, type CallHandler, type CanActivate, type ExceptionFilter, type ExecutionContext,
  type MessageEvent, type MiddlewareConsumer, type NestInterceptor, type NestMiddleware, type NestModule,
  type VersioningOptions, type PipeTransform,
  type OnModuleDestroy, type BeforeApplicationShutdown, type OnApplicationShutdown,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { Exclude, Type } from "class-transformer";
import { IsArray, IsInt, IsString, Min, ValidateNested } from "class-validator";
import {
  APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE, HttpAdapterHost, NestFactory, REQUEST,
} from "@nestjs/core";
import { WsAdapter } from "@nestjs/platform-ws";
import { MessageBody, SubscribeMessage, WebSocketGateway } from "@nestjs/websockets";
import {
  NodeHttpAdapter, FileInterceptor as NodeFileInterceptor, FilesInterceptor as NodeFilesInterceptor,
  FileFieldsInterceptor as NodeFileFieldsInterceptor, AnyFilesInterceptor as NodeAnyFilesInterceptor,
} from "nestjs-adapter-node";
import type {
  DiskUploadedFileData, NativeAdapterOptions, NativeRequest, NativeResponse,
  UploadedFile as NativeUpload, UploadInterceptorOptions, UploadFileFilter,
} from "nestjs-adapter-node";
import {
  BunHttpAdapter, BunWsAdapter, FileInterceptor as BunFileInterceptor,
  FilesInterceptor as BunFilesInterceptor, FileFieldsInterceptor as BunFileFieldsInterceptor,
  AnyFilesInterceptor as BunAnyFilesInterceptor,
} from "nestjs-adapter-bun";
import type { UploadedFile as BunUploadedFile } from "nestjs-adapter-bun";

const uploadDirectory = ${JSON.stringify(uploadDirectory)};
const staticDirectory = ${JSON.stringify(staticDirectory)};
const viewsDirectory = ${JSON.stringify(viewsDirectory)};
const tlsKeyPath = ${JSON.stringify(tlsKey)};
const tlsCertPath = ${JSON.stringify(tlsCert)};
@WebSocketGateway({ path: "/ws" })
class EchoGateway {
  @SubscribeMessage("echo")
  echo(@MessageBody() data: unknown) {
    return { event: "echo", data };
  }
}
@WebSocketGateway({ namespace: "chat" })
class ChatGateway {
  @SubscribeMessage("ping")
  ping(@MessageBody() data: unknown) {
    return { event: "pong", data };
  }
}
@Controller()
class GatewayHttpController {
  @Get("health")
  health() { return { ok: true }; }
  @Get("secure")
  secure(@Req() request: NativeRequest) {
    return { protocol: request.protocol, secure: request.secure };
  }
}
@Module({ controllers: [GatewayHttpController], providers: [EchoGateway] })
class GatewayModule {}
@Module({ controllers: [GatewayHttpController], providers: [ChatGateway] })
class SocketIoModule {}
const finished: string[] = [];
const uploadState = { guards: 0, handlers: 0, paths: [] as string[] };
@Injectable()
class UploadGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<NativeRequest>();
    assert.equal(request.uploads?.length, 1, "Disk parsing precedes guards");
    const file = request.uploads![0]!;
    assert.equal(await readFile(file.path, "utf8"), "fixture upload");
    uploadState.paths.push(file.path);
    uploadState.guards++;
    throw new UnauthorizedException();
  }
}
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

class PublicAccount {
  readonly name = "fixture";
  @Exclude()
  readonly secret = "must-not-be-serialized";
}
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

  @Get("response/passthrough")
  @UseInterceptors(ClassSerializerInterceptor)
  async passthrough(@Res({ passthrough: true }) response: NativeResponse) {
    response.status(202).header("x-response-mode", "passthrough");
    response.cookie("response-session", "fixture", { httpOnly: true });
    await delay(5);
    return new PublicAccount();
  }

  @Get("response/manual")
  @UseInterceptors(ClassSerializerInterceptor)
  async manual(@Res() response: NativeResponse) {
    await delay(5);
    response.status(202).header("x-response-mode", "manual").json({ manual: true });
    return { ignored: true };
  }

  @Get("response/empty")
  @HttpCode(204)
  empty(@Res({ passthrough: true }) response: NativeResponse) {
    response.header("x-response-mode", "empty").type("application/json");
    return { ignored: true };
  }

  @Get("response/redirect")
  @Redirect("/api/health", 302)
  redirect() {
    return { url: "/api/response/passthrough", statusCode: 303 };
  }

  @Get("response/failure")
  async responseFailure(@Res({ passthrough: true }) response: NativeResponse) {
    response.header("x-response-mode", "failure").type("text/plain");
    await delay(5);
    throw new ConflictException("fixture response failure");
  }

  @Post("upload")
  @UseInterceptors(
    process.argv[2] === "bun" ? BunFileInterceptor("file") : NodeFileInterceptor("file"),
  )
  async upload(@UploadedFile() file: DiskUploadedFileData, @Body() body: unknown) {
    return { originalname: file.originalname, content: await readFile(file.path, "utf8"), body };
  }

  @Post("upload/guard")
  @UseGuards(UploadGuard)
  guardedUpload() {
    uploadState.handlers++;
    throw new Error("A rejected upload must never reach its handler");
  }

  @Post("upload/validated")
  @UseInterceptors(
    process.argv[2] === "bun" ? BunFileInterceptor("file") : NodeFileInterceptor("file"),
  )
  validatedUpload(@UploadedFile(new ParseFilePipe({
    validators: [new MaxFileSizeValidator({ maxSize: 8 })],
  })) file: DiskUploadedFileData) {
    uploadState.handlers++;
    return { size: file.size };
  }

  @Post("upload/failure")
  @UseInterceptors(
    process.argv[2] === "bun" ? BunFileInterceptor("file") : NodeFileInterceptor("file"),
  )
  async failedUpload(@UploadedFile() file: DiskUploadedFileData) {
    uploadState.handlers++;
    uploadState.paths.push(file.path);
    assert.equal(await readFile(file.path, "utf8"), "fixture upload");
    await delay(10);
    assert.equal(await readFile(file.path, "utf8"), "fixture upload");
    throw new ConflictException("fixture upload failure");
  }
}
@Module({
  controllers: [HealthController, ScopedController],
  providers: [AuthGuard, UploadGuard, RequestIdentity, IdentityMiddleware, IdentityGuard, IdentityInterceptor, IdentityFilter],
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
  const passthrough = await fetch(\`\${base}/response/passthrough\`);
  assert.equal(passthrough.status, 202);
  assert.equal(passthrough.headers.get("x-response-mode"), "passthrough");
  assert.ok(passthrough.headers.get("set-cookie")?.includes("response-session=fixture"));
  assert.deepEqual(await passthrough.json(), { name: "fixture" },
    "Passthrough responses must still run class serialization");
  const manual = await fetch(\`\${base}/response/manual\`, { signal: AbortSignal.timeout(2000) });
  assert.equal(manual.status, 202);
  assert.equal(manual.headers.get("x-response-mode"), "manual");
  assert.deepEqual(await manual.json(), { manual: true },
    "Nest must not send the returned value after a manual response");
  const empty = await fetch(\`\${base}/response/empty\`);
  assert.equal(empty.status, 204);
  assert.equal(empty.headers.get("x-response-mode"), "empty");
  assert.equal(empty.headers.get("content-type"), null);
  assert.equal(empty.headers.get("content-length"), null);
  assert.equal(await empty.text(), "");
  const redirect = await fetch(\`\${base}/response/redirect\`, { redirect: "manual" });
  assert.equal(redirect.status, 303);
  assert.equal(redirect.headers.get("location"), "/api/response/passthrough");
  await redirect.text();
  const failedResponse = await fetch(\`\${base}/response/failure\`);
  assert.equal(failedResponse.status, 409);
  assert.equal(failedResponse.headers.get("x-response-mode"), "failure");
  assert.match(failedResponse.headers.get("content-type") ?? "", /application\\/json/);
  assert.equal((await failedResponse.json()).message, "fixture response failure");
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
  const cleanUploads = async () => {
    const deadline = Date.now() + 2000;
    while ((await readdir(uploadDirectory)).length) {
      assert.ok(Date.now() < deadline, "Rejected uploads must not leave temporary directories");
      await delay(10);
    }
  };
  const formFor = (contents: string, field = "file") => {
    const form = new FormData();
    form.append(field, new Blob([contents]), "fixture.txt");
    return form;
  };
  for (const [path, status, body] of [
    ["/upload/guard", 401, formFor("fixture upload")],
    ["/upload/validated", 400, formFor("fixture upload")],
    ["/upload/validated", 400, new FormData()],
    ["/upload", 400, formFor("fixture upload", "unexpected")],
    ["/upload/failure", 409, formFor("fixture upload")],
    ["/upload", 413, formFor("a".repeat(1025))],
  ] as const) {
    const response = await fetch(\`\${base}\${path}\`, { method: "POST", body });
    assert.equal(response.status, status, \`Upload rejection at \${path}\`);
    const error = await response.json();
    if (status === 401) assert.deepEqual(error, { denied: true });
    else assert.equal(error.statusCode, status);
    await cleanUploads();
  }
  const multiple = formFor("first");
  multiple.append("file", new Blob(["second"]), "second.txt");
  const rejectedMultiple = await fetch(\`\${base}/upload\`, { method: "POST", body: multiple });
  assert.equal(rejectedMultiple.status, 413);
  await rejectedMultiple.text();
  await cleanUploads();
  const malformed = await fetch(\`\${base}/upload\`, {
    method: "POST",
    headers: { "content-type": "multipart/form-data; boundary=fixture-truncated" },
    body: '--fixture-truncated\\r\\nContent-Disposition: form-data; name="file"; filename="partial.txt"\\r\\n\\r\\npartial',
  });
  assert.equal(malformed.status, 400, "Truncated multipart must be a client error");
  await malformed.text();
  await cleanUploads();
  assert.equal(uploadState.guards, 1);
  assert.equal(uploadState.handlers, 1, "Only the deliberate handler failure invokes user code");
  await Promise.all(Array.from({ length: 8 }, async (_, index) => {
    const failure = index % 2 === 0;
    const response = await fetch(\`\${base}/upload\${failure ? "/failure" : ""}\`, {
      method: "POST", body: formFor("fixture upload"),
    });
    assert.equal(response.status, failure ? 409 : 201);
    const body = await response.json();
    if (!failure) assert.equal(body.content, "fixture upload");
  }));
  await cleanUploads();
  assert.equal(uploadState.handlers, 5);
  assert.equal(new Set(uploadState.paths).size, 6, "Disk paths must be isolated per request");
  for (const path of uploadState.paths) {
    await assert.rejects(readFile(path), { code: "ENOENT" });
  }
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
const sseState = { active: new Set<string>(), finalized: [] as string[] };
@Controller("events")
class EventsController {
  @Sse("finite")
  finite(): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      subscriber.next({ id: "first", type: "update", retry: 1500, data: { value: 7 } });
      subscriber.next({ id: "second", type: "note", data: "line one\\nline two" });
      subscriber.complete();
    });
  }
  @Sse("live")
  live(@Req() request: NativeRequest): Observable<MessageEvent> {
    const id = request.headers["x-request-id"];
    assert.ok(typeof id === "string");
    const lastEventId = request.headers["last-event-id"];
    return new Observable((subscriber) => {
      assert.ok(!sseState.active.has(id));
      sseState.active.add(id);
      let index = 0;
      const timer = setInterval(() => {
        subscriber.next({ id: String(index++), type: "update", data: { requestId: id, lastEventId } });
      }, 10);
      return () => {
        clearInterval(timer);
        assert.ok(sseState.active.delete(id));
        sseState.finalized.push(id);
      };
    });
  }
}
@Module({ controllers: [EventsController] })
class EventsModule {}
const eventsAdapter = process.argv[2] === "bun" ? new BunHttpAdapter() : new NodeHttpAdapter();
const eventsApp = await NestFactory.create(EventsModule, eventsAdapter, { logger: false });
const readers: ReadableStreamDefaultReader<Uint8Array>[] = [];
const waitFor = async (condition: () => boolean, message: string) => {
  const deadline = Date.now() + 2000;
  while (!condition()) {
    assert.ok(Date.now() < deadline, message);
    await delay(10);
  }
};
try {
  await eventsApp.listen(0, "127.0.0.1");
  const base = await eventsApp.getUrl();
  const finite = await fetch(\`\${base}/events/finite\`, { signal: AbortSignal.timeout(5000) });
  assert.equal(finite.status, 200);
  assert.match(finite.headers.get("content-type") ?? "", /text\\/event-stream/);
  const events = (await finite.text()).replaceAll("\\r\\n", "\\n").trim().split("\\n\\n");
  assert.equal(events.length, 2);
  assert.deepEqual(events[0]!.split("\\n").sort(),
    ['data: {"value":7}', "event: update", "id: first", "retry: 1500"].sort());
  assert.deepEqual(events[1]!.split("\\n").sort(),
    ["data: line one", "data: line two", "event: note", "id: second"].sort());
  for (const id of ["client-a", "client-b", "client-c"]) {
    const response = await fetch(\`\${base}/events/live\`, {
      headers: { "x-request-id": id, "last-event-id": \`resume-\${id}\` },
      signal: AbortSignal.timeout(10000),
    });
    assert.equal(response.status, 200);
    assert.ok(response.body);
    const reader = response.body.getReader();
    readers.push(reader);
    const decoder = new TextDecoder();
    let text = "";
    while (!text.includes("\\n\\n", text.indexOf("data:"))) {
      const chunk = await reader.read();
      assert.ok(!chunk.done, \`Live SSE ended early: \${JSON.stringify(text)}; state=\${JSON.stringify(sseState)}\`);
      text += decoder.decode(chunk.value, { stream: true });
    }
    const data = text.split("\\n").find((line) => line.startsWith("data: "));
    assert.ok(data);
    assert.deepEqual(JSON.parse(data.slice(6)), { requestId: id, lastEventId: \`resume-\${id}\` });
  }
  assert.equal(sseState.active.size, 3, "SSE clients must stay subscribed simultaneously");
  await readers[0]!.cancel();
  await waitFor(() => sseState.finalized.includes("client-a"), "Cancellation must unsubscribe");
  assert.deepEqual([...sseState.active].sort(), ["client-b", "client-c"]);
  const stillLive = await readers[1]!.read();
  assert.equal(stillLive.done, false, "Cancelling one client must not close other streams");
  await Promise.all(readers.slice(1).map((reader) => reader.cancel()));
  await waitFor(() => sseState.active.size === 0, "All SSE subscriptions must be released");
  assert.deepEqual(sseState.finalized.sort(), ["client-a", "client-b", "client-c"]);
  const recovered = await fetch(\`\${base}/events/finite\`, { signal: AbortSignal.timeout(5000) });
  assert.equal(recovered.status, 200);
  assert.match(await recovered.text(), /id: second/);
} finally {
  await Promise.all(readers.map((reader) => reader.cancel()));
  await eventsApp.close();
}
for (const kind of ["graceful", "timeout", "forced"] as const) {
  const hooks: string[] = [];
  let startRequest!: () => void;
  const started = new Promise<void>((resolve) => { startRequest = resolve; });
  let releaseRequest!: () => void;
  const released = new Promise<void>((resolve) => { releaseRequest = resolve; });
  let startShutdown!: () => void;
  const shutdownStarted = new Promise<void>((resolve) => { startShutdown = resolve; });
  @Injectable()
  class ShutdownHooks implements OnModuleDestroy, BeforeApplicationShutdown, OnApplicationShutdown {
    async onModuleDestroy() {
      await delay(5);
      hooks.push("destroy");
    }
    async beforeApplicationShutdown() {
      hooks.push("before");
      startShutdown();
      await delay(5);
    }
    async onApplicationShutdown() {
      hooks.push("after");
    }
  }
  @Controller("shutdown")
  class ShutdownController {
    @Get("slow")
    async slow() {
      startRequest();
      await released;
      return { drained: true };
    }
  }
  @Module({ controllers: [ShutdownController, EventsController], providers: [ShutdownHooks] })
  class ShutdownModule {}
  const options: NativeAdapterOptions = { shutdownTimeout: kind === "forced" ? 5000 : 200 };
  const adapter = process.argv[2] === "bun" ? new BunHttpAdapter(options) : new NodeHttpAdapter(options);
  const app = await NestFactory.create(ShutdownModule, adapter, {
    logger: false, forceCloseConnections: kind === "forced",
  });
  let closing: Promise<void> | undefined;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    await app.listen(0, "127.0.0.1");
    const base = await app.getUrl();
    if (kind === "graceful") {
      const pending = fetch(\`\${base}/shutdown/slow\`, { signal: AbortSignal.timeout(5000) });
      await started;
      closing = app.close();
      await shutdownStarted;
      assert.deepEqual(hooks, ["destroy", "before"]);
      releaseRequest();
      const response = await pending;
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { drained: true });
      await closing;
    } else {
      const id = \`shutdown-\${kind}\`;
      const response = await fetch(\`\${base}/events/live\`, {
        headers: { "x-request-id": id }, signal: AbortSignal.timeout(5000),
      });
      assert.ok(response.body);
      reader = response.body.getReader();
      await waitFor(() => sseState.active.has(id), "Shutdown SSE producer must start");
      const before = performance.now();
      closing = app.close();
      const settled = Promise.allSettled([(async () => {
        while (!(await reader!.read()).done) {}
      })()]);
      await closing;
      const elapsed = performance.now() - before;
      if (kind === "timeout") assert.ok(elapsed >= 180 && elapsed < 2000,
        \`Shutdown timeout must bound active SSE: \${elapsed}ms\`);
      else assert.ok(elapsed < 2000, \`Forced close must not wait for 5000ms: \${elapsed}ms\`);
      const [result] = await settled;
      if (result!.status === "rejected") {
        assert.notEqual(result!.reason?.name, "TimeoutError", "Server, not the client timeout, must close SSE");
      }
      await waitFor(() => !sseState.active.has(id), "Shutdown must release the SSE producer");
      assert.equal(sseState.finalized.filter((value) => value === id).length, 1);
    }
    assert.deepEqual(hooks, ["destroy", "before", "after"], "Lifecycle hooks run once in order");
    await assert.rejects(fetch(\`\${base}/shutdown/slow\`, { signal: AbortSignal.timeout(1000) }),
      (error: Error) => error.name !== "TimeoutError",
      "Closed server must refuse new connections");
  } finally {
    releaseRequest();
    await (closing ?? app.close());
    reader?.releaseLock();
  }
}
const middlewareVisits: string[] = [];
@Controller("access")
class AccessController {
  @Get("public/:id")
  publicGet(@Param("id") id: string) { return { id }; }
  @Post("public/:id")
  publicPost(@Param("id") id: string) { return { id }; }
  @Get("private/:id")
  privateGet(@Param("id") id: string) { return { id }; }
  @Get("bypass/:id")
  bypassGet(@Param("id") id: string) { return { id }; }
  @Post("bypass/:id")
  bypassPost(@Param("id") id: string) { return { id }; }
}
@Controller("health")
class PublicHealthController {
  @Get()
  get() { return { health: true }; }
  @Post()
  post() { return { health: true }; }
}
@Module({ controllers: [AccessController, PublicHealthController] })
class AccessModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply((request: NativeRequest, response: NativeResponse, next: () => void) => {
      middlewareVisits.push(\`trace:\${request.method}:\${request.path}\`);
      response.header("x-trace", "fixture");
      next();
    }).forRoutes("*");
    consumer.apply((request: NativeRequest, response: NativeResponse, next: () => void) => {
      middlewareVisits.push(\`auth:\${request.method}:\${request.path}\`);
      response.header("x-auth-middleware", "checked");
      if (request.headers["x-auth"] !== "yes") {
        response.status(401).json({ denied: true });
        return;
      }
      next();
    }).exclude(
      { path: "access/public/:id", method: RequestMethod.GET },
      { path: "health", method: RequestMethod.GET },
      "access/bypass/:id",
    ).forRoutes(AccessController, PublicHealthController);
  }
}
const accessAdapter = process.argv[2] === "bun" ? new BunHttpAdapter() : new NodeHttpAdapter();
const accessApp = await NestFactory.create(AccessModule, accessAdapter, { logger: false });
try {
  accessApp.setGlobalPrefix("api", {
    exclude: [{ path: "health", method: RequestMethod.GET }],
  });
  await accessApp.listen(0, "127.0.0.1");
  const base = await accessApp.getUrl();
  for (const [path, method, auth, status, checked, body] of [
    ["/health", "GET", false, 200, false, { health: true }],
    ["/api/health", "POST", false, 401, true, { denied: true }],
    ["/api/health", "POST", true, 201, true, { health: true }],
    ["/api/access/public/42?fixture=1", "GET", false, 200, false, { id: "42" }],
    ["/api/access/public/42", "POST", false, 401, true, { denied: true }],
    ["/api/access/public/42", "POST", true, 201, true, { id: "42" }],
    ["/api/access/private/7", "GET", false, 401, true, { denied: true }],
    ["/api/access/private/7", "GET", true, 200, true, { id: "7" }],
    ["/api/access/bypass/7", "GET", false, 200, false, { id: "7" }],
    ["/api/access/bypass/7", "POST", false, 201, false, { id: "7" }],
  ] as const) {
    const before = middlewareVisits.length;
    const response = await fetch(\`\${base}\${path}\`, {
      method, headers: auth ? { "x-auth": "yes" } : {},
    });
    assert.equal(response.status, status, \`Middleware exclusions: \${method} \${path}\`);
    assert.deepEqual(await response.json(), body);
    assert.equal(response.headers.get("x-trace"), "fixture");
    assert.equal(response.headers.get("x-auth-middleware"), checked ? "checked" : null);
    const requestPath = path.split("?")[0];
    assert.deepEqual(middlewareVisits.slice(before), [
      \`trace:\${method}:\${requestPath}\`,
      ...(checked ? [\`auth:\${method}:\${requestPath}\`] : []),
    ], "Exclusions must skip only their middleware and preserve registration order");
  }
  for (const path of ["/api/health", "/health/extra", "/access/public/42"]) {
    const response = await fetch(\`\${base}\${path}\`);
    assert.equal(response.status, 404, \`Prefix exclusions must not create aliases: \${path}\`);
    await response.text();
  }
} finally {
  await accessApp.close();
}
const versionVisits: string[] = [];
@Controller({ path: "catalog", version: "1" })
class CatalogController {
  @Get(":id")
  first(@Param("id") id: string) { return { id, version: "1" }; }
  @Get(":id")
  @Version("2")
  second(@Param("id") id: string) { return { id, version: "2" }; }
  @Get("shared/:id")
  @Version(["1", "2"])
  shared(@Param("id") id: string) { return { id, shared: true }; }
  @Get("neutral/status")
  @Version(VERSION_NEUTRAL)
  neutral() { return { neutral: true }; }
}
@Controller("default")
class DefaultVersionController {
  @Get()
  get() { return { default: true }; }
}
@Module({ controllers: [CatalogController, DefaultVersionController] })
class VersionedModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply((request: NativeRequest, response: NativeResponse, next: () => void) => {
      versionVisits.push(request.path);
      response.header("x-version-middleware", "fixture");
      next();
    }).forRoutes(CatalogController, DefaultVersionController);
  }
}
for (const prefix of ["v", "release-", false] as const) {
  const adapter = process.argv[2] === "bun" ? new BunHttpAdapter() : new NodeHttpAdapter();
  const app = await NestFactory.create(VersionedModule, adapter, { logger: false });
  try {
    app.setGlobalPrefix("api");
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1", prefix });
    await app.listen(0, "127.0.0.1");
    const base = await app.getUrl();
    const v1 = prefix === false ? "1" : \`\${prefix}1\`;
    const v2 = prefix === false ? "2" : \`\${prefix}2\`;
    for (const [path, expected] of [
      [\`/api/\${v1}/catalog/42\`, { id: "42", version: "1" }],
      [\`/api/\${v2}/catalog/42?fixture=1\`, { id: "42", version: "2" }],
      [\`/api/\${v1}/catalog/shared/7\`, { id: "7", shared: true }],
      [\`/api/\${v2}/catalog/shared/7\`, { id: "7", shared: true }],
      ["/api/catalog/neutral/status", { neutral: true }],
      [\`/api/\${v1}/default\`, { default: true }],
    ] as const) {
      const before = versionVisits.length;
      const response = await fetch(\`\${base}\${path}\`);
      assert.equal(response.status, 200, \`URI version route: \${path}\`);
      assert.deepEqual(await response.json(), expected);
      assert.equal(response.headers.get("x-version-middleware"), "fixture");
      assert.deepEqual(versionVisits.slice(before), [path.split("?")[0]],
        "Controller middleware must match every version exactly once");
    }
    for (const path of [
      "/api/catalog/42", \`/api/\${prefix === false ? "3" : \`\${prefix}3\`}/catalog/42\`,
      \`/api/\${v1}/catalog/neutral/status\`, \`/api/\${v2}/default\`,
      \`/\${v1}/catalog/42\`,
    ]) {
      const response = await fetch(\`\${base}\${path}\`);
      assert.equal(response.status, 404, \`URI version aliases must not exist: \${path}\`);
      await response.text();
    }
  } finally {
    await app.close();
  }
}
@Controller("negotiated")
class NegotiatedController {
  @Get("choice")
  @Version("1")
  first() { return { version: "1" }; }
  @Get("choice")
  @Version(["2", "3"])
  second() { return { version: "2/3" }; }
  @Get("choice")
  @Version(VERSION_NEUTRAL)
  fallback() { return { version: "neutral" }; }
  @Get("strict")
  @Version("2")
  strict() { return { version: "2" }; }
}
@Module({ controllers: [NegotiatedController] })
class NegotiatedModule {}
for (const custom of [false, true]) {
  const options: VersioningOptions = custom
    ? {
        type: VersioningType.CUSTOM,
        extractor: (request: unknown) => {
          const value = (request as NativeRequest).query.version;
          return value === undefined ? [] : value;
        },
      }
    : { type: VersioningType.MEDIA_TYPE, key: "v=" };
  const app = await NestFactory.create(NegotiatedModule,
    process.argv[2] === "bun" ? new BunHttpAdapter() : new NodeHttpAdapter(),
    { logger: false });
  try {
    app.setGlobalPrefix("api");
    app.enableVersioning(options);
    await app.listen(0, "127.0.0.1");
    const base = await app.getUrl();
    const query = async (path: string, versions: string[]) => {
      const search = custom && versions.length
        ? "?" + new URLSearchParams(versions.map((version) => ["version", version])).toString()
        : "";
      const headers: Record<string, string> = custom ? {} : {
        accept: versions.length ? "application/json; charset=utf-8; v=" + versions[0] : "application/json",
      };
      const response = await fetch(base + "/api/negotiated/" + path + search, { headers });
      return { status: response.status, body: await response.json() };
    };
    for (const [versions, expected] of [
      [["1"], "1"], [["2"], "2/3"], [["3"], "2/3"],
      [["9"], "neutral"], [[], "neutral"],
    ] as const) {
      assert.deepEqual(await query("choice", [...versions]), {
        status: 200, body: { version: expected },
      });
    }
    assert.deepEqual(await query("strict", ["2"]), { status: 200, body: { version: "2" } });
    for (const versions of [[], ["1"], ["9"]]) {
      assert.equal((await query("strict", versions)).status, 404);
    }
    if (custom) {
      assert.deepEqual(await query("choice", ["3", "1"]), {
        status: 200, body: { version: "1" },
      }, "Matching follows handler registration order, not extractor preference order");
      assert.deepEqual(await query("choice", ["9", "3"]), {
        status: 200, body: { version: "2/3" },
      });
    }
    await Promise.all(Array.from({ length: 12 }, async (_, id) => {
      const version = id % 2 ? "1" : "3";
      assert.deepEqual(await query("choice", [version]), {
        status: 200, body: { version: version === "1" ? "1" : "2/3" },
      });
    }));
  } finally {
    await app.close();
  }
}
@Controller({ path: "site", host: "admin.example.test" })
class AdminHostController {
  @Get(":id")
  get(@Param("id") id: string) { return { site: "admin", id }; }
}
@Controller({ path: "site", host: ":tenant.example.test" })
class TenantHostController {
  @Get(":id")
  async get(@HostParam("tenant") tenant: string, @Param("id") id: string) {
    await delay(10);
    return { site: "tenant", tenant, id };
  }
}
@Controller({ path: "site", host: ["alias.example.org", "second.example.org"] })
class AliasHostController {
  @Get(":id")
  get(@Param("id") id: string) { return { site: "alias", id }; }
}
@Controller("site")
class DefaultHostController {
  @Get(":id")
  get(@Param("id") id: string, @HostParam() hosts: Record<string, string>) {
    return { site: "default", id, hosts };
  }
}
@Controller("proxy")
class ProxyMetadataController {
  @Get()
  inspect(@Req() request: NativeRequest) {
    return {
      ip: request.ip, ips: request.ips, protocol: request.protocol, host: request.host,
      hostname: request.hostname, secure: request.secure, subdomains: request.subdomains,
    };
  }
}
@Module({ controllers: [AdminHostController, TenantHostController, AliasHostController, DefaultHostController, ProxyMetadataController] })
class HostsModule {}
for (const trustProxy of [false, true]) {
  const adapter = process.argv[2] === "bun"
    ? new BunHttpAdapter({ trustProxy }) : new NodeHttpAdapter({ trustProxy });
  const app = await NestFactory.create(HostsModule, adapter, { logger: false });
  try {
    app.setGlobalPrefix("api");
    await app.listen(0, "127.0.0.1");
    const endpoint = \`\${await app.getUrl()}/api/site/42\`;
    const query = async (
      host: string,
      forwarded?: string,
      headers: Record<string, string> = {},
      path = "/api/site/42",
    ) => {
      return new Promise<unknown>((resolve, reject) => {
        const request = httpRequest(new URL(path, endpoint), {
          headers: { host, ...(forwarded ? { "x-forwarded-host": forwarded } : {}), ...headers },
        }, (response) => {
          const chunks: Buffer[] = [];
          response.on("data", (chunk: Buffer) => chunks.push(chunk));
          response.on("error", reject);
          response.on("end", () => {
            try {
              assert.equal(response.statusCode, 200);
              resolve(JSON.parse(Buffer.concat(chunks).toString()));
            } catch (error) { reject(error); }
          });
        });
        request.on("error", reject);
        request.end();
      });
    };
    assert.deepEqual(await query("admin.example.test:8080"), { site: "admin", id: "42" });
    assert.deepEqual(await query("alpha.example.test"), { site: "tenant", tenant: "alpha", id: "42" });
    for (const host of ["alias.example.org", "second.example.org"]) {
      assert.deepEqual(await query(host), { site: "alias", id: "42" });
    }
    assert.deepEqual(await query("unknown.example.org"), { site: "default", id: "42", hosts: {} });
    assert.deepEqual(await query("direct.example.org", "proxy.example.test:8443"),
      trustProxy ? { site: "tenant", tenant: "proxy", id: "42" }
        : { site: "default", id: "42", hosts: {} });
    const forwardedRequest = await query("direct.example.test", undefined, {
      "x-forwarded-for": "198.51.100.1, 203.0.113.7",
      "x-forwarded-proto": "https, http",
      "x-forwarded-host": "tenant.api.example.test:8443, second.example.test",
    }, "/api/proxy");
    assert.deepEqual(forwardedRequest, trustProxy
      ? {
          ip: "198.51.100.1", ips: ["198.51.100.1", "203.0.113.7"], protocol: "https",
          host: "tenant.api.example.test:8443", hostname: "tenant.api.example.test",
          secure: true, subdomains: ["api", "tenant"],
        }
      : {
          ip: "127.0.0.1", ips: [], protocol: "http", host: "direct.example.test",
          hostname: "direct.example.test", secure: false, subdomains: ["direct"],
        });
    await Promise.all(Array.from({ length: 8 }, async (_, index) => {
      const tenant = \`tenant-\${index}\`;
      assert.deepEqual(await query(\`\${tenant}.example.test\`), { site: "tenant", tenant, id: "42" });
    }));
  } finally {
    await app.close();
  }
}
{
  const isBun = process.argv[2] === "bun";
  const adapter = isBun ? new BunHttpAdapter() : new NodeHttpAdapter();
  const app = await NestFactory.create(GatewayModule, adapter, { logger: false });
  if (isBun) app.useWebSocketAdapter(new BunWsAdapter(app));
  else app.useWebSocketAdapter(new WsAdapter(app));
  try {
    await app.listen(0, "127.0.0.1");
    const base = await app.getUrl();
    const endpoint = base.replace(/^http/, "ws") + "/ws";
    const exchange = (id: number) => new Promise<unknown>((resolve, reject) => {
      const socket = new WebSocket(endpoint);
      let reply: unknown;
      const timer = setTimeout(() => {
        socket.terminate();
        reject(new Error(\`WebSocket echo timed out for client \${id}\`));
      }, 5000);
      socket.on("open", () => {
        socket.send("not json");
        socket.send(JSON.stringify({ event: "unknown", data: { id } }));
        socket.send(JSON.stringify({ event: "echo", data: { id } }));
      });
      socket.on("message", (data) => {
        try {
          reply = JSON.parse(data.toString());
          socket.close();
        } catch (error) {
          clearTimeout(timer);
          socket.terminate();
          reject(error);
        }
      });
      socket.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      socket.on("close", () => {
        clearTimeout(timer);
        if (reply === undefined) reject(new Error(\`WebSocket closed before echo for client \${id}\`));
        else resolve(reply);
      });
    });
    assert.deepEqual(await Promise.all(
      Array.from({ length: 8 }, (_, id) => exchange(id)),
    ), Array.from({ length: 8 }, (_, id) => ({ event: "echo", data: { id } })));
    assert.deepEqual(await (await fetch(\`\${base}/health\`)).json(), { ok: true });
  } finally {
    await app.close();
  }
}
{
  const adapter = new NodeHttpAdapter();
  const app = await NestFactory.create(SocketIoModule, adapter, { logger: false });
  try {
    await app.listen(0, "127.0.0.1");
    const base = await app.getUrl();
    for (const transports of [["polling", "websocket"], ["websocket"]]) {
      const exchangeSocketIo = (id: number) => new Promise<unknown>((resolve, reject) => {
        const socket = connectSocket(\`\${base}/chat\`, { transports, forceNew: true });
        const timer = setTimeout(() => {
          socket.close();
          reject(new Error(\`Socket.IO timed out for client \${id} (\${transports.join()})\`));
        }, 5000);
        socket.on("connect", () => socket.emit("ping", { id }));
        socket.on("pong", (reply: unknown) => {
          clearTimeout(timer);
          socket.close();
          resolve(reply);
        });
        socket.on("connect_error", (error) => {
          clearTimeout(timer);
          socket.close();
          reject(error);
        });
      });
      assert.deepEqual(await Promise.all(
        Array.from({ length: 8 }, (_, id) => exchangeSocketIo(id)),
      ), Array.from({ length: 8 }, (_, id) => ({ id })));
    }
    assert.equal((await fetch(\`\${base}/socket.io/socket.io.js\`)).status, 200);
    assert.deepEqual(await (await fetch(\`\${base}/health\`)).json(), { ok: true });
  } finally {
    await app.close();
  }
}
const localLimits: UploadInterceptorOptions = { limits: { fileSize: 4, files: 1 } };
const LocalFile = process.argv[2] === "bun" ? BunFileInterceptor : NodeFileInterceptor;
const LocalFiles = process.argv[2] === "bun" ? BunFilesInterceptor : NodeFilesInterceptor;
const LocalFields = process.argv[2] === "bun" ? BunFileFieldsInterceptor : NodeFileFieldsInterceptor;
const LocalAny = process.argv[2] === "bun" ? BunAnyFilesInterceptor : NodeAnyFilesInterceptor;
const filterUpload: UploadFileFilter = (request, file, callback) => {
  assert.equal((request.body as Record<string, unknown>).note, "fixture");
  assert.equal(file.fieldname, "file");
  assert.equal(file.mimetype, "application/octet-stream");
  assert.equal("path" in file, false);
  assert.equal("buffer" in file, false);
  if (file.originalname === "error.txt") {
    setTimeout(() => callback(new ConflictException("filter rejected")), 5);
  } else if (file.originalname === "throw.txt") {
    throw new ConflictException("filter threw");
  } else {
    setTimeout(() => callback(null, file.originalname !== "skip.txt"),
      file.originalname === "first.txt" ? 15 : 0);
  }
};
const filterOptions: UploadInterceptorOptions = { fileFilter: filterUpload };
class DeferredUploadGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<NativeRequest>();
    assert.equal(request.body, undefined);
    assert.equal(request.uploads, undefined);
    return request.headers["x-allow"] === "yes";
  }
}
@Controller("local-upload")
@UseGuards(DeferredUploadGuard)
class LocalUploadController {
  @Post("small")
  @UseInterceptors(LocalFile("file", localLimits))
  small(@UploadedFile() file: NativeUpload, @Body() body: Record<string, unknown>) {
    return { size: file.size, note: body.note };
  }
  @Post("large")
  @UseInterceptors(LocalFile("file", { limits: { fileSize: 16 } }))
  large(@UploadedFile() file: NativeUpload) { return { size: file.size }; }
  @Post("many")
  @UseInterceptors(LocalFiles("file", 2, localLimits))
  many(@UploadedFiles() files: NativeUpload[]) { return files.map((file) => file.size); }
  @Post("fields")
  @UseInterceptors(LocalFields([{ name: "file" }], localLimits))
  fields(@UploadedFiles() files: Record<string, NativeUpload[]>) {
    return files.file!.map((file) => file.size);
  }
  @Post("any")
  @UseInterceptors(LocalAny(localLimits))
  any(@UploadedFiles() files: NativeUpload[]) { return files.map((file) => file.size); }
  @Post("plain")
  @UseInterceptors(LocalFile("file"))
  plain(@UploadedFile() file: NativeUpload) { return { size: file.size }; }
  @Post("failure")
  @UseInterceptors(LocalFile("file", localLimits))
  failure() { throw new ConflictException("upload failed"); }
  @Post("filter-one")
  @UseInterceptors(LocalFile("file", filterOptions))
  filterOne(@UploadedFile() file: NativeUpload | undefined) {
    return { name: file?.originalname ?? null };
  }
  @Post("filter-many")
  @UseInterceptors(LocalFiles("file", 2, filterOptions))
  filterMany(@UploadedFiles() files: NativeUpload[]) {
    return files.map((file) => file.originalname);
  }
  @Post("filter-fields")
  @UseInterceptors(LocalFields([{ name: "file" }], filterOptions))
  filterFields(@UploadedFiles() files: Record<string, NativeUpload[]>) {
    return (files.file ?? []).map((file) => file.originalname);
  }
  @Post("filter-any")
  @UseInterceptors(LocalAny(filterOptions))
  filterAny(@UploadedFiles() files: NativeUpload[]) {
    return files.map((file) => file.originalname);
  }
}
@Module({ controllers: [LocalUploadController] })
class LocalUploadModule {}
for (const disk of [false, true]) {
  const options: NativeAdapterOptions = {
    uploadParsing: "interceptor", uploadLimit: 4096, uploadFileLimit: 8, uploadFilesLimit: 3,
    ...(disk ? { uploadStorage: { directory: uploadDirectory } } : {}),
  };
  const app = await NestFactory.create(LocalUploadModule,
    process.argv[2] === "bun" ? new BunHttpAdapter(options) : new NodeHttpAdapter(options),
    { logger: false });
  try {
    await app.listen(0, "127.0.0.1");
    const base = await app.getUrl();
    const post = async (
      path: string, size: number, count = 1, allowed = true, field = "file", note = "fixture",
    ) => {
      const form = new FormData();
      form.append("note", note);
      for (let i = 0; i < count; i++) form.append(field, new Blob(["x".repeat(size)]), \`\${i}.txt\`);
      const response = await fetch(\`\${base}/local-upload/\${path}\`, {
        method: "POST", headers: { "x-allow": allowed ? "yes" : "no" }, body: form,
      });
      return { status: response.status, body: await response.json() };
    };
    for (const path of ["small", "many", "fields", "any"]) {
      assert.deepEqual(await post(path, 4), {
        status: 201, body: path === "small" ? { size: 4, note: "fixture" } : [4],
      });
      assert.equal((await post(path, 5)).status, 413);
      assert.equal((await post(path, 1, 2)).status, 413);
    }
    assert.deepEqual(await post("large", 8), { status: 201, body: { size: 8 } });
    assert.equal((await post("large", 9)).status, 413);
    assert.equal((await post("large", 1, 4)).status, 413);
    assert.equal((await post("small", 100, 1, false)).status, 403);
    assert.deepEqual(await post("plain", 8), { status: 201, body: { size: 8 } });
    assert.equal((await post("plain", 9)).status, 413);
    assert.equal((await post("small", 1, 1, true, "unexpected")).status, 400);
    assert.equal((await post("failure", 4)).status, 409);
    assert.equal((await post("small", 1, 1, true, "file", "x".repeat(4096))).status, 413);
    const malformed = await fetch(base + "/local-upload/small", {
      method: "POST", headers: {
        "x-allow": "yes", "content-type": "multipart/form-data; boundary=truncated",
      },
      body: '--truncated\\r\\nContent-Disposition: form-data; name="file"; filename="partial.txt"\\r\\n\\r\\nx',
    });
    assert.equal(malformed.status, 400);
    await malformed.arrayBuffer();
    const filtered = async (path: string, names: string[]) => {
      const form = new FormData();
      form.append("note", "fixture");
      for (const name of names) form.append("file", new Blob(["ok"]), name);
      const response = await fetch(\`\${base}/local-upload/\${path}\`, {
        method: "POST", headers: { "x-allow": "yes" }, body: form,
      });
      return { status: response.status, body: await response.json() };
    };
    assert.deepEqual(await filtered("filter-one", ["skip.txt"]), {
      status: 201, body: { name: null },
    });
    assert.deepEqual(await filtered("filter-one", ["keep.txt"]), {
      status: 201, body: { name: "keep.txt" },
    });
    for (const path of ["filter-many", "filter-fields", "filter-any"]) {
      assert.deepEqual(await filtered(path, ["first.txt", "skip.txt", "last.txt"]), {
        status: 201, body: ["first.txt", "last.txt"],
      });
      for (const name of ["error.txt", "throw.txt"]) {
        const rejected = await filtered(path, ["first.txt", name]);
        assert.equal(rejected.status, 409);
        assert.equal(rejected.body.message, name === "error.txt" ? "filter rejected" : "filter threw");
      }
    }
    await Promise.all(Array.from({ length: 8 }, async (_, id) => {
      assert.deepEqual(await filtered("filter-one", [id % 2 ? "keep.txt" : "skip.txt"]), {
        status: 201, body: { name: id % 2 ? "keep.txt" : null },
      });
    }));
    await Promise.all(Array.from({ length: 8 }, async (_, id) => {
      const oversized = id % 2 === 0;
      assert.equal((await post("small", oversized ? 5 : 4)).status, oversized ? 413 : 201);
    }));
    await new Promise<void>((resolve, reject) => {
      const request = httpRequest(base + "/local-upload/small", {
        method: "POST", headers: {
          "x-allow": "yes", "content-type": "multipart/form-data; boundary=early",
        },
      });
      const timer = setTimeout(() => {
        request.destroy();
        reject(new Error("Local file limit waited for the entire request body"));
      }, 3000);
      request.on("error", (error) => { clearTimeout(timer); reject(error); });
      request.on("response", (response) => {
        response.resume();
        response.on("end", () => {
          clearTimeout(timer);
          try { assert.equal(response.statusCode, 413); resolve(); }
          catch (error) { reject(error); }
          finally { request.destroy(); }
        });
      });
      request.write('--early\\r\\nContent-Disposition: form-data; name="file"; filename="oversized.txt"\\r\\n\\r\\n');
      request.write("x".repeat(128));
    });
  } finally {
    await app.close();
  }
  assert.deepEqual(await readdir(uploadDirectory), []);
}
{
  const isBun = process.argv[2] === "bun";
  const app = await NestFactory.create(
    GatewayModule,
    isBun ? new BunHttpAdapter() : new NodeHttpAdapter(),
    {
      logger: false,
      httpsOptions: { key: await readFile(tlsKeyPath), cert: await readFile(tlsCertPath) },
    },
  );
  app.useWebSocketAdapter(isBun ? new BunWsAdapter(app) : new WsAdapter(app));
  try {
    await app.listen(0, "127.0.0.1");
    const base = (await app.getUrl()).replace(/^http:/, "https:");
    if (isBun) {
      const response = await fetch(base + "/secure", {
        tls: { rejectUnauthorized: false },
      } as RequestInit);
      assert.deepEqual(await response.json(), { protocol: "https", secure: true });
    } else {
      const response = await new Promise<{ status: number; body: string }>((resolve, reject) => {
        httpsGet(base + "/secure", { rejectUnauthorized: false }, (incoming) => {
          const chunks: Buffer[] = [];
          incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
          incoming.on("error", reject);
          incoming.on("end", () => resolve({
            status: incoming.statusCode ?? 0,
            body: Buffer.concat(chunks).toString(),
          }));
        }).on("error", reject);
      });
      assert.equal(response.status, 200);
      assert.deepEqual(JSON.parse(response.body), { protocol: "https", secure: true });
    }
  } finally {
    await app.close();
  }
}
@Controller("assets")
class StaticFallbackController {
  @Get("missing")
  fallback() { return { fallback: true }; }
}
@Module({ controllers: [StaticFallbackController] })
class StaticModule {}
{
  const adapter = process.argv[2] === "bun" ? new BunHttpAdapter() : new NodeHttpAdapter();
  const app = await NestFactory.create(StaticModule, adapter, { logger: false });
  try {
    adapter.useStaticAssets(staticDirectory, {
      prefix: "/assets", maxAge: 60_000,
      setHeaders: (response) => { response.setHeader("x-static", "fixture"); },
    });
    await app.listen(0, "127.0.0.1");
    const base = await app.getUrl();
    const get = (path: string, headers: Record<string, string> = {}) =>
      fetch(base + path, { headers });
    const full = await get("/assets/sample.txt");
    assert.equal(full.status, 200);
    assert.equal(await full.text(), "0123456789");
    assert.equal(full.headers.get("cache-control"), "public, max-age=60");
    assert.equal(full.headers.get("x-static"), "fixture");
    assert.equal(full.headers.get("accept-ranges"), "bytes");
    const etag = full.headers.get("etag");
    const modified = full.headers.get("last-modified");
    assert.ok(etag);
    assert.ok(modified);
    const validators: Record<string, string>[] = [
      { "if-none-match": etag }, { "if-modified-since": modified },
    ];
    for (const headers of validators) {
      const cached = await get("/assets/sample.txt", { "cache-control": "max-age=0", ...headers });
      assert.equal(cached.status, 304);
      assert.equal(await cached.text(), "");
    }
    const head = await fetch(base + "/assets/sample.txt", { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(head.headers.get("content-length"), "10");
    assert.equal(await head.text(), "");
    for (const [range, expected, contentRange] of [
      ["bytes=2-5", "2345", "bytes 2-5/10"],
      ["bytes=-3", "789", "bytes 7-9/10"],
    ]) {
      const partial = await get("/assets/sample.txt", { range });
      assert.equal(partial.status, 206);
      assert.equal(partial.headers.get("content-range"), contentRange);
      assert.equal(await partial.text(), expected);
    }
    const stale = await get("/assets/sample.txt", { range: "bytes=2-5", "if-range": '"stale"' });
    assert.equal(stale.status, 200);
    assert.equal(await stale.text(), "0123456789");
    const impossible = await get("/assets/sample.txt", { range: "bytes=20-" });
    assert.equal(impossible.status, 416);
    await impossible.arrayBuffer();
    const precondition = await get("/assets/sample.txt", { "if-match": '"stale"' });
    assert.equal(precondition.status, 412);
    await precondition.arrayBuffer();
    const redirect = await fetch(base + "/assets/docs?fixture=1", { redirect: "manual" });
    assert.equal(redirect.status, 301);
    assert.equal(redirect.headers.get("location"), "/assets/docs/?fixture=1");
    await redirect.arrayBuffer();
    assert.equal(await (await get("/assets/docs/")).text(), "<h1>fixture</h1>");
    assert.deepEqual(await (await get("/assets/missing")).json(), { fallback: true });
    for (const path of ["/assets/.hidden", "/assetsmissing", "/assets/not-found.txt"]) {
      const response = await get(path);
      assert.equal(response.status, 404);
      await response.arrayBuffer();
    }
    await Promise.all(Array.from({ length: 8 }, async (_, id) => {
      const response = await get("/assets/sample.txt", { range: \`bytes=\${id}-\${id}\` });
      assert.equal(response.status, 206);
      assert.equal(await response.text(), String(id));
    }));
  } finally {
    await app.close();
  }
}
@Controller("pages")
class ViewsController {
  @Get("hello/:name")
  @Render("hello")
  async hello(@Param("name") name: string) {
    await delay(5);
    return { name };
  }
  @Get("explicit")
  @Render("hello.ejs")
  explicit() { return { name: "explicit" }; }
  @Get("missing")
  @Render("not-found")
  missing() { return {}; }
  @Get("broken")
  @Render("broken")
  broken() { return {}; }
}
@Module({ controllers: [ViewsController] })
class ViewsModule {}
for (const custom of [false, true]) {
  const adapter = process.argv[2] === "bun" ? new BunHttpAdapter() : new NodeHttpAdapter();
  const app = await NestFactory.create(ViewsModule, adapter, { logger: false });
  try {
    app.setGlobalPrefix("api");
    adapter.setBaseViewsDir([staticDirectory, viewsDirectory]);
    adapter.setViewEngine(custom ? {
      extension: "ejs",
      render: (path, data, callback) => {
        void (async () => {
          await delay(5);
          const template = await readFile(path, "utf8");
          if (template.includes("missingVariable")) throw new Error("Fixture render failed");
          if (!("name" in data) || typeof data.name !== "string") throw new Error("Missing view name");
          return template.replace("<%= name %>", data.name);
        })().then((html) => callback(null, html), (error: unknown) => callback(error));
      },
    } : "ejs");
    await app.listen(0, "127.0.0.1");
    const base = await app.getUrl();
    const hello = await fetch(base + "/api/pages/hello/Ada");
    assert.equal(hello.status, 200);
    assert.match(hello.headers.get("content-type") ?? "", /^text\\/html/);
    assert.equal(await hello.text(), "<h1>Hello Ada</h1>");
    if (!custom) {
      const escaped = await fetch(base + "/api/pages/hello/" + encodeURIComponent("<b>"));
      assert.equal(await escaped.text(), "<h1>Hello &lt;b&gt;</h1>");
    }
    assert.equal(await (await fetch(base + "/api/pages/explicit")).text(), "<h1>Hello explicit</h1>");
    const head = await fetch(base + "/api/pages/hello/Ada", { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
    for (const path of ["missing", "broken"]) {
      const response = await fetch(base + "/api/pages/" + path);
      assert.equal(response.status, 500);
      assert.deepEqual(await response.json(), { statusCode: 500, message: "Internal server error" });
    }
    await Promise.all(Array.from({ length: 8 }, async (_, id) => {
      const response = await fetch(base + "/api/pages/hello/guest-" + id);
      assert.equal(response.status, 200);
      assert.equal(await response.text(), \`<h1>Hello guest-\${id}</h1>\`);
    }));
  } finally {
    await app.close();
  }
}
class FormItemDto {
  @IsString()
  name!: string;
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}
class NestedFormDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormItemDto)
  items!: FormItemDto[];
  @IsArray()
  @IsString({ each: true })
  tags!: string[];
}
let formHandlers = 0;
@Controller("forms")
class FormController {
  @Post("nested")
  nested(@Body() body: NestedFormDto) {
    assert.ok(body instanceof NestedFormDto);
    assert.ok(body.items.every((item) => item instanceof FormItemDto));
    formHandlers++;
    return body;
  }
  @Post("raw")
  raw(@Body() body: unknown) { formHandlers++; return body; }
}
@Module({ controllers: [FormController] })
class FormModule {}
{
  const options = { bodyLimit: 256 };
  const app = await NestFactory.create(FormModule,
    process.argv[2] === "bun" ? new BunHttpAdapter(options) : new NodeHttpAdapter(options),
    { logger: false });
  try {
    app.useGlobalPipes(new ValidationPipe({
      transform: true, whitelist: true, forbidNonWhitelisted: true,
    }));
    await app.listen(0, "127.0.0.1");
    const base = await app.getUrl();
    const post = async (path: string, body: string) => {
      const response = await fetch(base + "/forms/" + path, {
        method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body,
      });
      return { status: response.status, body: await response.json() };
    };
    const valid = "items[0][name]=hello+world&items[0][quantity]=2&items[1][name]=%D0%BA%D0%B8%D1%97%D0%B2&items[1][quantity]=3&tags[]=one&tags[]=two";
    const expected = {
      items: [{ name: "hello world", quantity: 2 }, { name: "київ", quantity: 3 }],
      tags: ["one", "two"],
    };
    assert.deepEqual(await post("nested", valid), { status: 201, body: expected });
    assert.deepEqual(await post("raw", "tag=one&tag=two&empty=&flag"), {
      status: 201, body: { tag: ["one", "two"], empty: "", flag: "" },
    });
    const before = formHandlers;
    for (const body of [
      valid.replace("quantity]=2", "quantity]=0"), valid + "&extra=forbidden",
      "items[0][name]=one&items[0][quantity]=nope&tags[]=one",
      "items[broken=1", "list[]=one&list[key]=two",
    ]) {
      assert.equal((await post("nested", body)).status, 400);
    }
    assert.equal(formHandlers, before, "Invalid forms must never reach handlers");
    assert.equal((await post("raw", "a=" + "x".repeat(254))).status, 201);
    assert.equal((await post("raw", "a=" + "x".repeat(255))).status, 413);
    const unicodeBody = "a=" + "ї".repeat(128);
    assert.ok(unicodeBody.length < 256);
    assert.ok(Buffer.byteLength(unicodeBody) > 256);
    assert.equal((await post("raw", unicodeBody)).status, 413);
    assert.deepEqual(await post("nested", valid), { status: 201, body: expected });
    await Promise.all(Array.from({ length: 8 }, async (_, id) => {
      const body = "items[0][name]=item-" + id + "&items[0][quantity]=" + (id + 1) + "&tags[]=parallel";
      assert.deepEqual(await post("nested", body), {
        status: 201, body: { items: [{ name: "item-" + id, quantity: id + 1 }], tags: ["parallel"] },
      });
    }));
  } finally {
    await app.close();
  }
}
let corsHandlers = 0;
const corsOrigins: (string | undefined)[] = [];
@Controller("cors")
class CorsController {
  @Get()
  get() { corsHandlers++; return { ok: true }; }
  @Options()
  @HttpCode(200)
  options() { corsHandlers++; return { preflight: true }; }
}
@Module({ controllers: [CorsController] })
class CorsModule {}
for (const preflightContinue of [false, true]) {
  const app = await NestFactory.create(CorsModule,
    process.argv[2] === "bun" ? new BunHttpAdapter() : new NodeHttpAdapter(),
    { logger: false });
  try {
    app.enableCors({
      origin: (
        origin: string | undefined, callback: (error: Error | null, allowed?: boolean) => void,
      ) => {
        corsOrigins.push(origin);
        setTimeout(() => {
          if (origin === "https://error.test") callback(new ConflictException("origin rejected"));
          else callback(null, origin === "https://allowed.test");
        }, 5);
      },
      credentials: true, exposedHeaders: ["x-fixture"], methods: ["GET", "POST"],
      maxAge: 60, optionsSuccessStatus: 200, preflightContinue,
    });
    await app.listen(0, "127.0.0.1");
    const endpoint = (await app.getUrl()) + "/cors";
    const allowed = await fetch(endpoint, { headers: { origin: "https://allowed.test" } });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get("access-control-allow-origin"), "https://allowed.test");
    assert.equal(allowed.headers.get("access-control-allow-credentials"), "true");
    assert.equal(allowed.headers.get("access-control-expose-headers"), "x-fixture");
    assert.match(allowed.headers.get("vary") ?? "", /Origin/);
    await allowed.arrayBuffer();
    for (const origin of [undefined, "https://denied.test"]) {
      const headers: Record<string, string> = origin ? { origin } : {};
      const denied = await fetch(endpoint, { headers });
      assert.equal(denied.status, 200, "CORS denial must not act as server-side authorization");
      assert.equal(denied.headers.get("access-control-allow-origin"), null);
      assert.deepEqual(await denied.json(), { ok: true });
    }
    assert.ok(corsOrigins.includes(undefined), "Origin callback must also run without Origin");
    const before = corsHandlers;
    const error = await fetch(endpoint, { headers: { origin: "https://error.test" } });
    assert.equal(error.status, 409);
    assert.equal((await error.json()).message, "origin rejected");
    assert.equal(corsHandlers, before);
    const preflight = await fetch(endpoint, {
      method: "OPTIONS", headers: {
        origin: "https://allowed.test", "access-control-request-method": "POST",
        "access-control-request-headers": "x-token,x-request-id",
      },
    });
    assert.equal(preflight.status, 200);
    assert.equal(preflight.headers.get("access-control-allow-methods"), "GET,POST");
    assert.equal(preflight.headers.get("access-control-allow-headers"), "x-token,x-request-id");
    assert.equal(preflight.headers.get("access-control-max-age"), "60");
    assert.match(preflight.headers.get("vary") ?? "", /Access-Control-Request-Headers/);
    if (preflightContinue) {
      assert.deepEqual(await preflight.json(), { preflight: true });
      assert.equal(corsHandlers, before + 1);
    } else {
      assert.equal(await preflight.text(), "");
      assert.equal(preflight.headers.get("content-length"), "0");
      assert.equal(corsHandlers, before);
    }
    await Promise.all(Array.from({ length: 12 }, async (_, id) => {
      const origin = id % 2 ? "https://allowed.test" : "https://denied.test";
      const response = await fetch(endpoint, { headers: { origin } });
      assert.equal(response.headers.get("access-control-allow-origin"),
        id % 2 ? origin : null);
      assert.deepEqual(await response.json(), { ok: true });
    }));
  } finally {
    await app.close();
  }
}
const enhancerTrace = new WeakMap<NativeRequest, string[]>();
@Injectable()
class EnhancerService {
  normalize(value: string) {
    if (!/^\\d+$/.test(value)) throw new BadRequestException("Invalid fixture number");
    return Number(value);
  }
}
@Injectable()
class GlobalGuard implements CanActivate {
  constructor(@Inject(EnhancerService) private readonly service: EnhancerService) {}
  canActivate(context: ExecutionContext) {
    assert.ok(this.service instanceof EnhancerService);
    const request = context.switchToHttp().getRequest<NativeRequest>();
    enhancerTrace.set(request, ["guard"]);
    if (request.headers["x-auth"] !== "yes") throw new UnauthorizedException("Fixture denied");
    return true;
  }
}
@Injectable()
class GlobalPipe implements PipeTransform {
  constructor(@Inject(EnhancerService) private readonly service: EnhancerService) {}
  transform(value: string) { return this.service.normalize(value); }
}
@Injectable()
class GlobalInterceptor implements NestInterceptor {
  constructor(@Inject(EnhancerService) private readonly service: EnhancerService) {}
  intercept(context: ExecutionContext, next: CallHandler) {
    assert.ok(this.service instanceof EnhancerService);
    const request = context.switchToHttp().getRequest<NativeRequest>();
    const trace = enhancerTrace.get(request)!;
    trace.push("interceptor:before");
    return next.handle().pipe(map((data: unknown) => {
      trace.push("interceptor:after");
      return { data, trace };
    }));
  }
}
@Catch(HttpException)
class GlobalFilter implements ExceptionFilter<HttpException> {
  constructor(@Inject(HttpAdapterHost) private readonly adapterHost: HttpAdapterHost) {}
  catch(error: HttpException, context: ArgumentsHost) {
    const http = context.switchToHttp();
    const request = http.getRequest<NativeRequest>();
    this.adapterHost.httpAdapter.reply(http.getResponse<NativeResponse>(), {
      statusCode: error.getStatus(), message: error.message,
      trace: [...(enhancerTrace.get(request) ?? []), "filter"],
    }, error.getStatus());
  }
}
@Controller("enhanced")
class EnhancedController {
  @Get(":value")
  async get(@Param("value") value: number) {
    await delay(5);
    if (value === 13) throw new ConflictException("Fixture conflict");
    return { value, type: typeof value };
  }
}
@Module({
  controllers: [EnhancedController],
  providers: [
    EnhancerService, GlobalGuard, GlobalPipe, GlobalInterceptor, GlobalFilter,
    { provide: APP_GUARD, useExisting: GlobalGuard },
    { provide: APP_PIPE, useExisting: GlobalPipe },
    { provide: APP_INTERCEPTOR, useExisting: GlobalInterceptor },
    { provide: APP_FILTER, useExisting: GlobalFilter },
  ],
})
class EnhancedModule {}
{
  const app = await NestFactory.create(EnhancedModule,
    process.argv[2] === "bun" ? new BunHttpAdapter() : new NodeHttpAdapter(),
    { logger: false });
  try {
    await app.listen(0, "127.0.0.1");
    const base = await app.getUrl();
    const query = async (value: string, authenticated = true) => {
      const response = await fetch(base + "/enhanced/" + value, {
        headers: { "x-auth": authenticated ? "yes" : "no" },
      });
      return { status: response.status, body: await response.json() };
    };
    assert.deepEqual(await query("7"), { status: 200, body: {
      data: { value: 7, type: "number" }, trace: ["guard", "interceptor:before", "interceptor:after"],
    } });
    for (const [value, auth, status, message, trace] of [
      ["7", false, 401, "Fixture denied", ["guard", "filter"]],
      ["invalid", true, 400, "Invalid fixture number", ["guard", "interceptor:before", "filter"]],
      ["13", true, 409, "Fixture conflict", ["guard", "interceptor:before", "filter"]],
    ] as const) {
      assert.deepEqual(await query(value, auth), { status, body: { statusCode: status, message, trace } });
    }
    await Promise.all(Array.from({ length: 12 }, async (_, id) => {
      const value = id + 20;
      assert.deepEqual(await query(String(value)), { status: 200, body: {
        data: { value, type: "number" }, trace: ["guard", "interceptor:before", "interceptor:after"],
      } });
    }));
  } finally {
    await app.close();
  }
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
  await rm(tlsDirectory, { recursive: true, force: true });
}
