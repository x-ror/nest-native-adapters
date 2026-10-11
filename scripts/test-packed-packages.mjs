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
import {
  Body, Catch, Controller, Get, Injectable, Module, Param, Post, StreamableFile,
  UnauthorizedException, UploadedFile, UseGuards, UseInterceptors, ValidationPipe,
  Version, VersioningType,
  type ArgumentsHost, type CanActivate, type ExceptionFilter, type ExecutionContext,
  type MiddlewareConsumer, type NestModule,
} from "@nestjs/common";
import { Type } from "class-transformer";
import { IsInt, Min } from "class-validator";
import { NestFactory } from "@nestjs/core";
import { NodeHttpAdapter, FileInterceptor as NodeFileInterceptor } from "nestjs-adapter-node";
import type { DiskUploadedFileData, NativeAdapterOptions, NativeRequest, NativeResponse } from "nestjs-adapter-node";
import { BunHttpAdapter, FileInterceptor as BunFileInterceptor } from "nestjs-adapter-bun";
import type { UploadedFile as BunUploadedFile } from "nestjs-adapter-bun";

const uploadDirectory = ${JSON.stringify(uploadDirectory)};
const finished: string[] = [];
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
@Module({ controllers: [HealthController], providers: [AuthGuard] })
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
} finally {
  await app.close();
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
    execFileSync("node", ["dist/consumer.js", "node"], { cwd: consumer, stdio: "inherit" });
    execFileSync("bun", ["dist/consumer.js", "bun"], { cwd: consumer, stdio: "inherit" });
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
