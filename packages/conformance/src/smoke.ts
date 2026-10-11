import { ExpressAdapter } from "@nestjs/platform-express";
import { NodeHttpAdapter } from "nestjs-adapter-node";
import { compareAdapters } from "./compare.js";
import { checkLifecycle } from "./lifecycle.js";
import { checkNestIntegration } from "./integration.js";

await compareAdapters(
  () => new NodeHttpAdapter(),
  () => new ExpressAdapter(),
);
await checkLifecycle("native-node", (options) => new NodeHttpAdapter(options));
await checkNestIntegration("native-node", (options) => new NodeHttpAdapter(options));
