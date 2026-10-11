import "reflect-metadata";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  Body,
  Catch,
  ConflictException,
  Controller,
  HttpException,
  Inject,
  Injectable,
  MaxFileSizeValidator,
  Module,
  ParseFilePipe,
  Post,
  Req,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  ValidationPipe,
  type ArgumentsHost,
  type CallHandler,
  type CanActivate,
  type ExceptionFilter,
  type ExecutionContext,
  type NestInterceptor,
} from "@nestjs/common";
import { HttpAdapterHost, NestFactory, type AbstractHttpAdapter } from "@nestjs/core";
import { ApiBody, ApiConsumes, ApiProperty, DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsString, Min, MinLength } from "class-validator";
import { map } from "rxjs";
import {
  FileInterceptor,
  FilesInterceptor,
  type NativeAdapterOptions,
  type NativeRequest,
  type NativeResponse,
  type UploadedFile as Upload,
} from "nestjs-adapter-node";

const traces = new WeakMap<NativeRequest, string[]>();

class CreateItemDto {
  @ApiProperty({ minLength: 3 })
  @IsString()
  @MinLength(3)
  name!: string;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}

@Injectable()
class IntegrationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<NativeRequest>();
    traces.set(request, ["guard"]);
    return request.headers["x-auth"] === "yes";
  }
}

@Injectable()
class IntegrationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<NativeRequest>();
    traces.get(request)!.push("interceptor:before");
    return next.handle().pipe(
      map((data: unknown) => {
        const trace = traces.get(request)!;
        trace.push("interceptor:after");
        return { data, trace };
      }),
    );
  }
}

@Catch(HttpException)
class IntegrationFilter implements ExceptionFilter<HttpException> {
  constructor(@Inject(HttpAdapterHost) private readonly host: HttpAdapterHost) {}

  catch(exception: HttpException, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<NativeRequest>();
    this.host.httpAdapter.reply(
      http.getResponse<NativeResponse>(),
      {
        statusCode: exception.getStatus(),
        error: exception.getResponse(),
        trace: [...(traces.get(request) ?? []), "filter"],
      },
      exception.getStatus(),
    );
  }
}

@Injectable()
class IntegrationService {
  create(dto: CreateItemDto) {
    assert.ok(dto instanceof CreateItemDto, "ValidationPipe must transform the DTO");
    return { name: dto.name, quantity: dto.quantity };
  }

  async fail(): Promise<never> {
    await Promise.resolve();
    throw new ConflictException("async service conflict");
  }
}

async function describeUpload(file: Upload) {
  const content = "buffer" in file ? file.buffer : await readFile(file.path);
  return { name: file.originalname, size: file.size, content: content.toString("utf8") };
}

@Controller("items")
@UseGuards(IntegrationGuard)
@UseInterceptors(IntegrationInterceptor)
class IntegrationController {
  constructor(@Inject(IntegrationService) private readonly service: IntegrationService) {}

  @Post()
  create(@Body() dto: CreateItemDto, @Req() request: NativeRequest) {
    traces.get(request)!.push("handler");
    return this.service.create(dto);
  }

  @Post("conflict")
  conflict() {
    return this.service.fail();
  }

  @Post("upload")
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: { upload: { type: "string", format: "binary" } },
      required: ["upload"],
    },
  })
  @UseInterceptors(FileInterceptor("upload"))
  upload(
    @UploadedFile(new ParseFilePipe({ validators: [new MaxFileSizeValidator({ maxSize: 1024 })] }))
    file: Upload,
    @Req() request: NativeRequest,
  ) {
    assert.equal(request.file, file);
    return describeUpload(file);
  }

  @Post("uploads")
  @UseInterceptors(FilesInterceptor("upload", 2))
  uploads(@UploadedFiles() files: Upload[], @Req() request: NativeRequest) {
    assert.equal(request.files, files);
    return Promise.all(files.map(describeUpload));
  }
}

@Module({
  controllers: [IntegrationController],
  providers: [IntegrationService, IntegrationGuard, IntegrationInterceptor, IntegrationFilter],
})
class IntegrationModule {}

export async function checkNestIntegration(
  label: string,
  adapter: (options: NativeAdapterOptions) => AbstractHttpAdapter,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "nest-integration-"));
  try {
    for (const disk of [false, true]) {
      const app = await NestFactory.create(
        IntegrationModule,
        adapter(disk ? { uploadStorage: { directory } } : {}),
        { logger: false, abortOnError: false },
      );
      try {
        app.setGlobalPrefix("v1");
        app.useGlobalPipes(
          new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
        );
        app.useGlobalFilters(app.get(IntegrationFilter));
        const document = SwaggerModule.createDocument(
          app,
          new DocumentBuilder().setTitle("Native Nest integration").setVersion("1").build(),
        );
        SwaggerModule.setup("docs", app, document, { useGlobalPrefix: true });
        await app.listen(0, "127.0.0.1");
        const url = await app.getUrl();
        const json = (body: unknown, authenticated = true): RequestInit => ({
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(authenticated ? { "x-auth": "yes" } : {}),
          },
          body: JSON.stringify(body),
        });
        const expectJson = async (path: string, init: RequestInit, status: number) => {
          const response = await fetch(`${url}/v1${path}`, init);
          assert.equal(response.status, status, `${label} ${path}`);
          return response.json();
        };

        assert.deepEqual(await expectJson("/items", json({ name: "widget", quantity: "2" }), 201), {
          data: { name: "widget", quantity: 2 },
          trace: ["guard", "interceptor:before", "handler", "interceptor:after"],
        });
        const invalid = await expectJson(
          "/items",
          json({ name: "x", quantity: 0, extra: true }),
          400,
        );
        assert.deepEqual(invalid.trace, ["guard", "interceptor:before", "filter"]);
        assert.deepEqual(invalid.error.message.toSorted(), [
          "name must be longer than or equal to 3 characters",
          "property extra should not exist",
          "quantity must not be less than 1",
        ]);
        const denied = await expectJson(
          "/items",
          json({ name: "widget", quantity: 2 }, false),
          403,
        );
        assert.deepEqual(denied.trace, ["guard", "filter"]);
        const conflict = await expectJson("/items/conflict", json({}), 409);
        assert.equal(conflict.error.message, "async service conflict");
        assert.deepEqual(conflict.trace, ["guard", "interceptor:before", "filter"]);

        const multipart = (...contents: string[]): RequestInit => {
          const form = new FormData();
          for (const content of contents) form.append("upload", new Blob([content]), "hello.txt");
          return { method: "POST", headers: { "x-auth": "yes" }, body: form };
        };
        const file = { name: "hello.txt", size: 5, content: "hello" };
        const single = await expectJson("/items/upload", multipart("hello"), 201);
        assert.deepEqual(single.data, file);
        const multiple = await expectJson("/items/uploads", multipart("hello", "hello"), 201);
        assert.deepEqual(multiple.data, [file, file]);
        const missing = await expectJson("/items/upload", multipart(), 400);
        assert.equal(missing.error.message, "File is required");
        const oversized = await expectJson("/items/upload", multipart("x".repeat(1025)), 400);
        assert.match(oversized.error.message, /expected size is less than 1024/);
        const tooMany = await expectJson("/items/uploads", multipart("a", "b", "c"), 400);
        assert.match(tooMany.error.message, /Too many files/);

        const specResponse = await fetch(`${url}/v1/docs-json`);
        assert.equal(specResponse.status, 200);
        const spec = await specResponse.json();
        assert.equal(spec.info.title, "Native Nest integration");
        assert.ok(spec.paths["/v1/items"].post);
        assert.equal(spec.components.schemas.CreateItemDto.properties.quantity.minimum, 1);
        assert.equal(
          spec.paths["/v1/items/upload"].post.requestBody.content["multipart/form-data"].schema
            .properties.upload.format,
          "binary",
        );
        for (const [path, contentType, marker] of [
          ["/docs-yaml", "text/yaml", "Native Nest integration"],
          ["/docs/", "text/html", "Swagger UI"],
          ["/docs/swagger-ui.css", "text/css", ".swagger-ui"],
          ["/docs/swagger-ui-bundle.js", "javascript", "SwaggerUIBundle"],
          ["/docs/swagger-ui-init.js", "javascript", "Native Nest integration"],
        ] as const) {
          const response = await fetch(`${url}/v1${path}`);
          assert.equal(response.status, 200, path);
          assert.ok(response.headers.get("content-type")?.includes(contentType), path);
          assert.ok((await response.text()).includes(marker), path);
        }
      } finally {
        await app.close();
      }
      for (let attempt = 0; attempt < 100 && (await readdir(directory)).length; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      assert.deepEqual(
        await readdir(directory),
        [],
        "upload storage must be cleaned after responses",
      );
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
  console.log(
    `${label}: Nest validation, guards, filters, interceptors, Swagger and memory/disk upload integration passed.`,
  );
}
