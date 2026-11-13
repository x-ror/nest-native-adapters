---
title: Swagger
description: Serving OpenAPI documents and Swagger UI with @nestjs/swagger.
---

`@nestjs/swagger` works with both adapters:

```ts
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

app.setGlobalPrefix("v1");
const document = SwaggerModule.createDocument(
  app,
  new DocumentBuilder().setTitle("My API").setVersion("1").build(),
);
SwaggerModule.setup("docs", app, document, { useGlobalPrefix: true });
```

This serves `/v1/docs/`, `/v1/docs-json`, and `/v1/docs-yaml`, including local
Swagger UI scripts and styles. Describe DTO properties with `@ApiProperty()`
and uploads with `@ApiConsumes("multipart/form-data")` / `@ApiBody()`.
The Swagger CLI plugin is untested.
