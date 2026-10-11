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
  const stacks = [
    {
      name: "nest10-apollo4",
      module: "CommonJS",
      moduleResolution: "Node",
      dependencies: {
        "@nestjs/common": "10.1.3",
        "@nestjs/core": "10.2.8",
        "@nestjs/platform-express": "10.3.3",
        "@nestjs/graphql": "12.1.1",
        "@nestjs/apollo": "12.0.11",
        "@apollo/server": "4.10.0",
        graphql: "16.8.1",
        "reflect-metadata": "0.1.13",
        typescript: "5.2.2",
        "@types/node": "20.6.2",
        "ts-morph": "21.0.1",
        "@apollo/gateway": "2.7.0",
      },
    },
    {
      name: "nest12-apollo5",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      dependencies: {
        "@nestjs/common": "12.1.2",
        "@nestjs/core": "12.1.2",
        "@nestjs/platform-express": "12.1.2",
        "@nestjs/graphql": "14.0.3",
        "@nestjs/apollo": "14.0.3",
        "@apollo/server": "5.5.1",
        "@as-integrations/express5": "1.1.2",
        graphql: "16.11.0",
        "reflect-metadata": "0.2.2",
        typescript: "6.0.3",
        "@types/node": "26.6.4",
        "ts-morph": "28.0.0",
        "@apollo/gateway": "2.14.4",
      },
    },
  ];
  for (const stack of stacks) {
    const consumer = join(directory, stack.name);
    await mkdir(consumer);
    const dependencies = { ...stack.dependencies, rxjs: "7.8.2", "@types/ws": "8.5.13" };
    for (const archive of await readdir(tarballs)) {
      dependencies[archive.replace(/-\d.*\.tgz$/, "")] = `file:${join(tarballs, archive)}`;
    }
    await writeFile(
      join(consumer, "package.json"),
      JSON.stringify({ private: true, type: "module", dependencies }),
    );
    execFileSync("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], {
      cwd: consumer,
      stdio: "inherit",
    });
    await copyFile(join(root, "packages/apollo/test/consumer.mjs"), join(consumer, "consumer.mjs"));
    await writeFile(
      join(consumer, "consumer.ts"),
      `import { NativeApolloDriver } from "nestjs-adapter-apollo";
import type { ApolloDriverConfig } from "@nestjs/apollo";
const driver: ApolloDriverConfig["driver"] = NativeApolloDriver;
export { driver };
`,
    );
    await writeFile(
      join(consumer, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          module: stack.module,
          moduleResolution: stack.moduleResolution,
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
    execFileSync(join(consumer, "node_modules/.bin/tsc"), ["-p", "tsconfig.json"], {
      cwd: consumer,
      stdio: "inherit",
    });
    const results = [];
    for (const [runtime, mode] of [
      ["node", "express"],
      ["node", "node"],
      ["bun", "bun"],
    ]) {
      execFileSync(runtime, ["consumer.mjs", mode, stack.name], {
        cwd: consumer,
        stdio: "inherit",
        timeout: 60000,
      });
      results.push(JSON.parse(await readFile(join(consumer, `${mode}.json`), "utf8")));
    }
    for (const result of results.slice(1)) {
      for (const kind of ["function", "default"]) {
        assert.deepEqual(result[kind], results[0][kind], `${stack.name}: native matches Express`);
      }
    }
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}
