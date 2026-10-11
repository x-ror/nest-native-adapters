import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const directory = await mkdtemp(join(tmpdir(), "native-apollo-packed-"));
try {
  const tarballs = join(directory, "tarballs");
  await mkdir(tarballs);
  for (const name of ["nestjs-adapter-node", "nestjs-adapter-bun", "nestjs-adapter-apollo"]) {
    execFileSync("pnpm", ["--filter", name, "pack", "--pack-destination", tarballs], {
      cwd: root,
      stdio: "inherit",
    });
  }
  const dependencies = {
    "@nestjs/common": "10.1.3",
    "@nestjs/core": "10.2.8",
    "@nestjs/platform-express": "10.3.3",
    "@nestjs/graphql": "12.1.1",
    "@nestjs/apollo": "12.0.11",
    "@apollo/server": "4.10.0",
    graphql: "16.8.1",
    "reflect-metadata": "0.1.13",
    rxjs: "7.8.2",
    typescript: "5.2.2",
    "@types/node": "20.6.2",
    "@types/ws": "8.5.13",
    "ts-morph": "21.0.1",
    "@apollo/gateway": "2.7.0",
  };
  for (const archive of await readdir(tarballs)) {
    dependencies[archive.replace(/-\d.*\.tgz$/, "")] = `file:${join(tarballs, archive)}`;
  }
  await writeFile(
    join(directory, "package.json"),
    JSON.stringify({ private: true, type: "module", dependencies }),
  );
  execFileSync("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], {
    cwd: directory,
    stdio: "inherit",
  });
  await copyFile(join(root, "packages/apollo/test/consumer.mjs"), join(directory, "consumer.mjs"));
  await writeFile(
    join(directory, "consumer.ts"),
    `import { NativeApolloDriver } from "nestjs-adapter-apollo";
import type { ApolloDriverConfig } from "@nestjs/apollo";
const driver: ApolloDriverConfig["driver"] = NativeApolloDriver;
export { driver };
`,
  );
  await writeFile(
    join(directory, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        module: "CommonJS",
        moduleResolution: "Node",
        esModuleInterop: true,
        target: "ES2022",
        strict: true,
        skipLibCheck: false,
        noEmit: true,
        types: ["node"],
      },
      include: ["consumer.ts"],
    }),
  );
  execFileSync(join(directory, "node_modules/.bin/tsc"), ["-p", "tsconfig.json"], {
    cwd: directory,
    stdio: "inherit",
  });
  const results = [];
  for (const [runtime, mode] of [
    ["node", "express"],
    ["node", "node"],
    ["bun", "bun"],
  ]) {
    execFileSync(runtime, ["consumer.mjs", mode], {
      cwd: directory,
      stdio: "inherit",
      timeout: 60000,
    });
    results.push(JSON.parse(await readFile(join(directory, `${mode}.json`), "utf8")));
  }
  for (const result of results.slice(1)) {
    for (const kind of ["function", "default"]) {
      assert.deepEqual(result[kind], results[0][kind], "Native GraphQL matches Express");
    }
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}
