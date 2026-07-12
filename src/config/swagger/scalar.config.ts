import { INestApplication } from '@nestjs/common';
import { OpenAPIObject } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';

export class ScalarConfig {
  public static setup(path: string, app: INestApplication, document: OpenAPIObject): void {
    const scalarApiReference = apiReference(document);
    const scalarApiReferencePath = `${path}/scalar`;
    app.use(scalarApiReferencePath, scalarApiReference);
  }
}
