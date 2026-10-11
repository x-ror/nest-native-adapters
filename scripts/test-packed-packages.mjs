import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), "nestjs-adapter-packed-"));
const tarballs = join(temporary, "tarballs");
const consumer = join(temporary, "consumer");
const uploadDirectory = join(consumer, "uploads");

try {
  await Promise.all([
    mkdir(tarballs, { recursive: true }),
    mkdir(uploadDirectory, { recursive: true }),
  ]);
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

  const manifest = {
    private: true,
    type: "module",
    dependencies: {
      "@nestjs/common": "12.1.2",
      "@nestjs/core": "12.1.2",
      "nestjs-adapter-node": `file:${join(tarballs, nodeArchive)}`,
      "nestjs-adapter-bun": `file:${join(tarballs, bunArchive)}`,
      "reflect-metadata": "0.2.2",
      rxjs: "7.8.2",
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
import {
  Body, Controller, Get, Module, Post, UploadedFile, UseInterceptors,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NodeHttpAdapter, FileInterceptor as NodeFileInterceptor } from "nestjs-adapter-node";
import type { DiskUploadedFileData, NativeAdapterOptions, NativeRequest } from "nestjs-adapter-node";
import { BunHttpAdapter, FileInterceptor as BunFileInterceptor } from "nestjs-adapter-bun";
import type { UploadedFile as BunUploadedFile } from "nestjs-adapter-bun";

const uploadDirectory = ${JSON.stringify(uploadDirectory)};
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

  @Post("upload")
  @UseInterceptors(
    process.argv[2] === "bun" ? BunFileInterceptor("file") : NodeFileInterceptor("file"),
  )
  async upload(@UploadedFile() file: DiskUploadedFileData, @Body() body: unknown) {
    return { originalname: file.originalname, content: await readFile(file.path, "utf8"), body };
  }
}
@Module({ controllers: [HealthController] })
class HealthModule {}

const adapter =
  process.argv[2] === "bun" ? new BunHttpAdapter(options) : new NodeHttpAdapter(options);
const app = await NestFactory.create(HealthModule, adapter, { logger: false });
try {
  await app.listen(0, "127.0.0.1");
  const response = await fetch(\`\${await app.getUrl()}/health\`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });

  const form = new FormData();
  form.append("note", "packed");
  form.append("file", new Blob(["tarball upload works"]), "packed.txt");
  const upload = await fetch(\`\${await app.getUrl()}/upload\`, { method: "POST", body: form });
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
} finally {
  await app.close();
}
console.log(\`packed package smoke passed on \${process.argv[2]}\`);
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
} finally {
  await rm(temporary, { recursive: true, force: true });
}
