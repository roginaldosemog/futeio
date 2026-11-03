import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { INestApplication } from '@nestjs/common';

export function createOpenApiDocument(app: INestApplication) {
  const options = new DocumentBuilder().setTitle('Futeio API').setDescription('Closed-group football organization. Administrator access is available in E2.').setVersion('0.1.0').addCookieAuth('futeio_session', { type: 'apiKey', in: 'cookie' }, 'session').build();
  return SwaggerModule.createDocument(app, options);
}
